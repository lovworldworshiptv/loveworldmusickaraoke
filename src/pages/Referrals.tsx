import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Copy, Users, Wallet, Crown, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildInviteUrl, PAYOUT_MIN_ESPEES } from "@/lib/platformReferral";

const fmt = (n: number) => `${Number(n || 0).toFixed(2)} ESP`;

const Referrals = () => {
  const { user, username, kingschatHandle } = useAuth();
  const qc = useQueryClient();
  const [kc, setKc] = useState(kingschatHandle || "");
  const [busy, setBusy] = useState(false);
  const link = username && username !== "Guest" ? buildInviteUrl(username) : "";

  const { data: people = [] } = useQuery({
    queryKey: ["my-referrals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_referral_dashboard");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["referral-ledger", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("referral_ledger")
        .select("amount, kind, note, created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["referral-payouts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("referral_payouts")
        .select("id, amount, status, created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const balance = ledger.reduce((s, l) => s + Number(l.amount), 0);
  const earned = ledger.filter((l) => l.kind === "commission").reduce((s, l) => s + Number(l.amount), 0);
  const payers = people.filter((p) => p.is_premium_payer).length;

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Join Loveworld Music Karaoke+", url: link }); } catch { /* cancelled */ }
    } else copy();
  };

  const requestPayout = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("request_referral_payout", { p_kingschat: kc.trim() || null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Payout of ${fmt(Number(data))} requested`);
    qc.invalidateQueries({ queryKey: ["referral-ledger"] });
    qc.invalidateQueries({ queryKey: ["referral-payouts"] });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-foreground">My Referrals</h1>
          <p className="text-sm text-muted-foreground">Earn 10% of every verified premium payment from people you invite.</p>
        </header>

        <section className="glass-card rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Your invite link</p>
          <div className="flex gap-2">
            <Input readOnly value={link} aria-label="Your invite link" />
            <Button onClick={copy} variant="outline" aria-label="Copy link"><Copy className="w-4 h-4" /></Button>
            <Button onClick={share} aria-label="Share link"><Share2 className="w-4 h-4" /></Button>
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Referrals", value: String(people.length) },
            { icon: Crown, label: "Premium payers", value: String(payers) },
            { icon: Wallet, label: "Total earned", value: fmt(earned) },
            { icon: Wallet, label: "Balance", value: fmt(balance) },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-4">
              <s.icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="glass-card rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Use your balance</p>
          <p className="text-xs text-muted-foreground">
            Payouts open at {PAYOUT_MIN_ESPEES} ESPEES. You can also apply your balance to a subscription — it covers the full price or reduces what you pay.
          </p>
          <Input placeholder="KingsChat username for payout" value={kc} onChange={(e) => setKc(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={requestPayout} disabled={busy || balance < PAYOUT_MIN_ESPEES}>
              <Send className="w-4 h-4 mr-1.5" />
              {balance < PAYOUT_MIN_ESPEES ? `${fmt(PAYOUT_MIN_ESPEES - balance)} more to request payout` : `Request payout (${fmt(balance)})`}
            </Button>
            <Button asChild variant="outline"><Link to="/subscription">Apply to subscription</Link></Button>
          </div>
          {payouts.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1 pt-2">
              {payouts.map((p) => (
                <li key={p.id}>{new Date(p.created_at).toLocaleDateString()} — {fmt(Number(p.amount))} — <span className="capitalize">{p.status}</span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass-card rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-3">People you invited</p>
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet. Share your link to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {people.map((p, i) => (
                <li key={i} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.username}</span>
                  {p.is_premium_payer && <Crown className="w-4 h-4 text-primary" aria-label="Premium payer" />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default Referrals;
