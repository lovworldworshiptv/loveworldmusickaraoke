import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Copy, Users, Wallet, Crown, Send, Share2, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  const [open, setOpen] = useState<null | "people" | "payers" | "earned" | "balance">(null);
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
      try { await navigator.share({ title: "Join Loveworld Music Karaoke+", text: "Join me on Loveworld Music Karaoke+!\n\nGet the app: https://web.lwappstore.com/share/lW-APP-Y26-XX5010", url: link }); } catch { /* cancelled */ }
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
          {([
            { id: "people", icon: Users, label: "Referrals", value: String(people.length) },
            { id: "payers", icon: Crown, label: "Premium payers", value: String(payers) },
            { id: "earned", icon: Wallet, label: "Total earned", value: fmt(earned) },
            { id: "balance", icon: Wallet, label: "Balance", value: fmt(balance) },
          ] as const).map((s) => (
            <button key={s.id} type="button" onClick={() => setOpen(s.id)}
              className="glass-card rounded-2xl p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <s.icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 flex items-center text-[11px] text-primary">Tap for breakdown <ChevronRight className="w-3 h-3" /></p>
            </button>
          ))}
        </section>

        <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="max-h-[80dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{{ people: "Your referrals", payers: "Premium payers", earned: "Commission history", balance: "Balance breakdown" }[open ?? "people"]}</DialogTitle>
              <DialogDescription>
                {open === "balance" ? `Current balance: ${fmt(balance)}` : open === "earned" ? `Total earned: ${fmt(earned)}` : "Usernames only, for privacy."}
              </DialogDescription>
            </DialogHeader>
            {(open === "people" || open === "payers") && (() => {
              const list = open === "payers" ? people.filter((p) => p.is_premium_payer) : people;
              return list.length === 0 ? <p className="text-sm text-muted-foreground">Nobody here yet.</p> : (
                <ul className="divide-y divide-border">
                  {list.map((p, i) => (
                    <li key={i} className="py-2 flex items-center justify-between text-sm">
                      <span className="text-foreground flex items-center gap-1.5">{p.username}{p.is_premium_payer && <Crown className="w-3.5 h-3.5 text-primary" aria-label="Premium" />}</span>
                      <span className="text-xs text-muted-foreground">Joined {new Date(p.joined_at).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
            {(open === "earned" || open === "balance") && (() => {
              const rows = open === "earned" ? ledger.filter((l) => l.kind === "commission") : ledger;
              const label: Record<string, string> = { commission: "Commission", payout: "Payout", subscription: "Applied to subscription", refund: "Refund" };
              let running = balance;
              return rows.length === 0 ? <p className="text-sm text-muted-foreground">No entries yet.</p> : (
                <ul className="divide-y divide-border">
                  {rows.map((l, i) => {
                    const after = running; running -= Number(l.amount);
                    return (
                      <li key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="text-foreground">{label[l.kind] ?? l.kind}</p>
                          <p className="text-xs text-muted-foreground">{l.note ? `${l.note} · ` : ""}{new Date(l.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className={Number(l.amount) >= 0 ? "text-primary font-semibold" : "text-destructive font-semibold"}>{Number(l.amount) >= 0 ? "+" : ""}{fmt(Number(l.amount))}</p>
                          {open === "balance" && <p className="text-[11px] text-muted-foreground">Balance {fmt(after)}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </DialogContent>
        </Dialog>

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
