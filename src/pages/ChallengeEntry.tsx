import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useActiveChallenge, useMyEntry, isChallengeClosed } from "@/hooks/useChallenge";
import { supabase } from "@/integrations/supabase/client";
import { Upload, ArrowLeft, Crown, Trophy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const ChallengeEntry = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const { data: ch } = useActiveChallenge();
  const { data: entry, refetch } = useMyEntry(ch?.id);
  const [proof, setProof] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [kcUsername, setKcUsername] = useState("");
  const [zone, setZone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!ch) {
    return <AppLayout><div className="p-6 text-center text-sm text-muted-foreground">No active challenge.</div></AppLayout>;
  }

  const closed = isChallengeClosed(ch);

  if (entry?.status === "approved") {
    navigate("/games/challenge", { replace: true });
    return null;
  }

  const submit = async () => {
    if (!user) return;
    if (closed) { toast.error("This challenge has ended"); return; }
    if (!isPremium) {
      if (!fullName.trim()) { toast.error("Please enter your full name"); return; }
      if (!zone.trim()) { toast.error("Please enter your Zone"); return; }
      if (!proof) { toast.error("Please upload your payment proof"); return; }
    }
    setSubmitting(true);
    try {
      let proofUrl: string | null = null;
      if (proof) {
        // Path MUST start with the user's id to satisfy storage RLS on payment-proofs
        const safeName = proof.name.replace(/[^\w.\-]/g, "_");
        const path = `${user.id}/challenge-${ch.id}-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, proof, { upsert: false });
        if (upErr) throw upErr;
        proofUrl = path;
      }
      const referred_by = localStorage.getItem("challenge_ref");
      const { data, error } = await supabase.functions.invoke("submit-challenge-entry", {
        body: {
          challenge_id: ch.id,
          payment_proof_url: proofUrl,
          referred_by_user_id: referred_by,
          full_name: fullName || null,
          kingschat_username: kcUsername || null,
          zone: zone || null,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success(isPremium ? "You're in! Premium free entry." : "Entry submitted — awaiting approval");
      localStorage.removeItem("challenge_ref");
      await refetch();
      navigate("/games/challenge");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit entry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-8 max-w-md mx-auto">
        <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="glass-card p-6">
          <div className="text-center mb-5">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
            <h1 className="text-2xl font-serif font-bold">Enter {ch.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">Compete for {ch.prize_pool} Espees</p>
          </div>

          {closed && (
            <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> This challenge has ended. New entries are closed.
            </div>
          )}
          {entry?.status === "pending" && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
              Your entry was submitted and is awaiting admin approval.
            </div>
          )}
          {entry?.status === "rejected" && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              Previous entry rejected{entry.admin_notes ? `: ${entry.admin_notes}` : ""}. You can resubmit.
            </div>
          )}

          {isPremium ? (
            <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-sm mb-4 flex items-start gap-2">
              <Crown className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Premium Free Entry</p>
                <p className="text-xs text-muted-foreground">As a Premium member, your entry is free.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 p-4 rounded-lg bg-background/40 border border-border/50 text-sm space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Payment Details</p>
                  <p className="text-foreground">Espees Merchant Code: <span className="font-bold text-amber-400">LMM01</span></p>
                </div>
                <div className="border-t border-border/50 pt-3">
                  <p className="font-semibold text-foreground mb-1">Bank Transfer <span className="text-amber-400">[N2,050]</span></p>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p>Account No: <span className="text-foreground font-mono">1000316347</span></p>
                    <p>Account Name: <span className="text-foreground">LMAM - Music App</span></p>
                    <p>Bank: <span className="text-foreground">Parallex Bank</span></p>
                  </div>
                </div>
              </div>

              <label className="block mb-3">
                <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name <span className="text-destructive">*</span></span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>

              <label className="block mb-3">
                <span className="text-xs font-medium text-muted-foreground mb-1.5 block">KingsChat Username</span>
                <input
                  type="text"
                  value={kcUsername}
                  onChange={(e) => setKcUsername(e.target.value)}
                  placeholder="@yourhandle"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>

              <label className="block mb-3">
                <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Zone <span className="text-destructive">*</span></span>
                <input
                  type="text"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder="Your Zone"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>



              <label className="block mb-4">
                <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Proof of Transaction <span className="text-destructive">*</span></span>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => setProof(e.target.files?.[0] || null)} className="hidden" id="proof" />
                  <label htmlFor="proof" className="cursor-pointer block">
                    <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">{proof ? proof.name : "Select Image or Take Photo"}</span>
                  </label>
                </div>
              </label>
            </>
          )}

          <button onClick={submit} disabled={submitting || closed}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm disabled:opacity-60">
            {submitting ? "Submitting..." : closed ? "Challenge Ended" : isPremium ? "Enter Challenge (Free)" : "Submit Entry"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ChallengeEntry;
