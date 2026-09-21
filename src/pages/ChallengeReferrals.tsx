import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveChallenge, useReferralGateStatus, useMyScore, buildReferralUrl } from "@/hooks/useChallenge";
import { CHALLENGE_RESUME_KEY } from "@/hooks/useReferralGateGuard";
import { ArrowLeft, Copy, Users, CheckCircle2, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";

const ChallengeReferrals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: ch } = useActiveChallenge();
  const { data: myScore } = useMyScore(ch?.id);
  const { data: gate } = useReferralGateStatus(ch?.id);

  const refUrl = user ? buildReferralUrl(user.id) : "";
  const required = gate?.required ?? 0;
  const refCount = gate?.refCount ?? 0;
  const remaining = (gate as any)?.remaining ?? Math.max(0, required - refCount);
  const complete = required > 0 && refCount >= required;
  const gateScore = gate?.gateScore ?? ch?.referral_gate_score ?? 0;
  const currentScore = myScore?.total_score ?? gate?.currentScore ?? 0;
  const pct = required > 0 ? Math.min(100, Math.round((refCount / required) * 100)) : 0;

  // Auto-resume once the gate clears
  useEffect(() => {
    if (!complete) return;
    let resume: string | null = null;
    try { resume = localStorage.getItem(CHALLENGE_RESUME_KEY); } catch {}
    if (resume && resume !== "/games/challenge/referrals") {
      toast.success("Invites complete — resuming your game!");
      try { localStorage.removeItem(CHALLENGE_RESUME_KEY); } catch {}
      const t = setTimeout(() => navigate(resume, { replace: true }), 900);
      return () => clearTimeout(t);
    }
  }, [complete, navigate]);

  const copy = () => {
    if (!refUrl) return;
    navigator.clipboard.writeText(refUrl);
    toast.success("Referral link copied!");
  };

  const share = async () => {
    if (!refUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: "Join me in the Song Master Challenge", url: refUrl }); } catch {}
    } else {
      copy();
    }
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-8 max-w-xl mx-auto">
        <button onClick={() => navigate("/games/challenge")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Challenge
        </button>

        <div className="glass-card p-6 mb-5 text-center">
          <div className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${complete ? "bg-green-500/15" : "bg-amber-500/15"}`}>
            {complete ? <CheckCircle2 className="w-8 h-8 text-green-500" /> : <Users className="w-8 h-8 text-amber-400" />}
          </div>
          <h1 className="text-2xl font-serif font-bold mb-1">
            {complete ? "Milestone Advancement Cleared!" : "Refer Players to Advance"}
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            {complete
              ? "You've completed the required invites. Your games will now count toward your score."
              : `You've reached the Milestone Advancement Score of ${gateScore} pts (${currentScore} pts). Invite ${remaining} more player${remaining === 1 ? "" : "s"} to advance past this milestone.`}
          </p>

          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Invites completed</span>
              <span className="font-bold text-foreground tabular-nums">{refCount} / {required}</span>
            </div>
            <div className="h-2.5 rounded-full bg-background/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-green-500" : "bg-gradient-to-r from-amber-500 to-orange-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {complete ? "All done — auto-resuming your game…" : `${remaining} more to go`}
            </p>
          </div>

          {!complete && (
            <>
              <div className="flex gap-2 mb-3">
                <input readOnly value={refUrl} className="flex-1 px-3 py-2.5 rounded-lg bg-background border border-border text-xs font-mono" />
                <button onClick={copy} className="px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs flex items-center gap-1">
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <button onClick={share} className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" /> Share Referral Link
              </button>
              <p className="text-[11px] text-muted-foreground mt-3">
                Each invited player who joins and gets approved counts toward your gate.
              </p>
            </>
          )}

          {complete && (
            <button onClick={() => navigate("/games/challenge")} className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4" /> Continue Challenge
            </button>
          )}
        </div>

        <div className="glass-card p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">How the Milestone Advancement Score works</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>You reach the Milestone Advancement Score at <span className="text-foreground">{gateScore} pts</span>.</li>
            <li>Games you play afterwards don't count until you refer <span className="text-foreground">{required}</span> new player{required === 1 ? "" : "s"} to advance past the milestone.</li>
            <li>Once your invites are complete, we send you straight back to the game you were playing.</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
};

export default ChallengeReferrals;
