import { useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveChallenge, useMyEntry, useMyScore, useLeaderboard, buildReferralUrl } from "@/hooks/useChallenge";
import { CHALLENGE_RESUME_KEY } from "@/hooks/useReferralGateGuard";
import ChallengeCountdown from "@/components/games/ChallengeCountdown";
import { Trophy, Copy, ArrowLeft, Crown, Target, CheckCircle, LogOut, AlertCircle, Medal, Award, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsPremium } from "@/hooks/useIsPremium";


const Challenge = () => {
  const navigate = useNavigate();
  const { user, username } = useAuth();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { data: ch } = useActiveChallenge();
  const { data: entry, refetch: refetchEntry } = useMyEntry(ch?.id);
  const { data: myScore } = useMyScore(ch?.id);
  const { data: board = [] } = useLeaderboard(ch?.id);
  const { isPremium, loading: premiumLoading } = useIsPremium();


  // Capture ?ref= referrer (username or user_id) to localStorage
  useEffect(() => {
    const ref = params.get("ref");
    if (ref && ref !== user?.id && ref !== username) localStorage.setItem("challenge_ref", ref);
  }, [params, user?.id, username]);

  // If this visitor is already enrolled, tell the referrer their invite doesn't count
  useEffect(() => {
    const ref = params.get("ref");
    if (!ref || !user || !ch?.id || !entry) return;
    if (ref === user.id || ref === username) return;
    supabase.functions
      .invoke("record-duplicate-referral", { body: { challenge_id: ch.id, ref } })
      .then(({ data }: any) => {
        if (data?.duplicate) {
          toast.info("You're already in the Song Master Challenge, so this invite won't earn referral points.");
        }
      })
      .catch(() => {});
  }, [params, user, ch?.id, entry, username]);

  if (!ch) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-6 pb-8 max-w-2xl mx-auto text-center">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-2xl font-serif font-bold mb-2">No Active Challenge</h1>
          <p className="text-muted-foreground text-sm mb-6">There's no Song Master Challenge running right now. Check back soon!</p>
          <button onClick={() => navigate("/games")} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm">Back to Games</button>
        </div>
      </AppLayout>
    );
  }

  const myRow = board.find((r: any) => r.user_id === user?.id);
  const refUrl = user ? buildReferralUrl(username && username !== "Guest" ? username : user.id) : "";




  const leaveChallenge = async () => {
    if (!entry || !ch) return;
    if (!confirm("Leave this challenge? Your entry and progress will be removed and any entry fee is not refunded.")) return;
    const { error } = await supabase.from("challenge_entries" as any).delete().eq("id", entry.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("challenge_scores" as any).delete().eq("challenge_id", ch.id).eq("user_id", user!.id);
    toast.success("You left the challenge");
    qc.invalidateQueries({ queryKey: ["challenge-entry", ch.id] });
    qc.invalidateQueries({ queryKey: ["challenge-leaderboard", ch.id] });
    qc.invalidateQueries({ queryKey: ["challenge-my-score", ch.id] });
    refetchEntry();
  };


  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-8 max-w-3xl mx-auto">
        <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Games
        </button>

        <div className="glass-card p-5 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Song Master Challenge</span>
          </div>
          <h1 className="text-2xl font-serif font-bold mb-1">{ch.name}</h1>
          {ch.description && <p className="text-sm text-muted-foreground mb-4">{ch.description}</p>}
          <div className="mb-2 text-xs text-center text-muted-foreground">Ends In</div>
          <ChallengeCountdown endDate={ch.end_date} />
        </div>

        {entry?.status === "approved" && !premiumLoading && !isPremium && (
          <div className="glass-card p-5 mb-5 border border-amber-500/50 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm">Premium Required to Continue</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              The Song Master Challenge is for Premium subscribers only, for the full duration of the challenge.
              Your Premium subscription is no longer active, so your games won't earn points and your leaderboard
              position is temporarily hidden from everyone — including the prize ranking — until you renew.
            </p>
            <button onClick={() => navigate("/subscription")}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-xs flex items-center justify-center gap-2">
              <Crown className="w-3.5 h-3.5" /> Renew Premium
            </button>
          </div>
        )}

        {entry?.status === "approved" && (
          <div className="glass-card p-5 mb-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Your Progress</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-2xl font-bold text-amber-400">#{myRow?.rank ?? "—"}</p><p className="text-xs text-muted-foreground">Rank</p></div>
              <div><p className="text-2xl font-bold text-foreground">{myScore?.total_score ?? 0}</p><p className="text-xs text-muted-foreground">Points</p></div>
              <div><p className="text-2xl font-bold text-foreground">{myScore?.games_played ?? 0}</p><p className="text-xs text-muted-foreground">Games</p></div>
            </div>
            <div className="mt-3 text-center">
              {myScore?.qualified
                ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-500"><CheckCircle className="w-3 h-3" /> Qualified</span>
                : <span className="text-xs text-muted-foreground">Participating — {Math.max(0, (ch.qualification_min_games - (myScore?.games_played || 0)))} more games to qualify</span>}
            </div>
          </div>
        )}

        {entry?.status === "approved" && ch.referral_gate_score != null && (ch.referral_gate_required_invites ?? 0) > 0 && (
          <ReferralGateCard
            challengeId={ch.id}
            userId={user!.id}
            currentScore={myScore?.total_score ?? 0}
            gateScore={Number(ch.referral_gate_score)}
            required={Number(ch.referral_gate_required_invites)}
            refUrl={refUrl}
          />
        )}

        {/* Referral link card removed per product request; +50pts per referral logic still active. */}

        {entry && (
          <button onClick={leaveChallenge}
            className="w-full mb-5 py-2.5 rounded-lg border border-destructive/40 text-destructive text-xs font-semibold flex items-center justify-center gap-2 hover:bg-destructive/10">
            <LogOut className="w-3.5 h-3.5" /> Leave Challenge
          </button>
        )}

        {!entry && (
          <button onClick={() => navigate("/games/challenge/enter")}
            className="w-full mb-5 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2">
            <Crown className="w-4 h-4" /> Enter Challenge — {Number(ch.entry_fee) <= 0 ? "Free" : `${ch.entry_fee} Espee${Number(ch.entry_fee) === 1 ? "" : "s"}`}
          </button>
        )}

        <div className="glass-card p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Live Leaderboard</h3>
          {board.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No players yet. Be the first!</p>
          ) : (
            <div className="space-y-1.5">
              {(() => {
                const dist = (ch.prize_distribution || {}) as Record<string, number>;
                const prizeRanks = new Set(Object.keys(dist).filter(k => Number(dist[k]) > 0).map(k => Number(k)));
                const medalFor = (rank: number) => {
                  if (rank === 1) return <Medal className="w-5 h-5 text-amber-400" />;
                  if (rank === 2) return <Medal className="w-5 h-5 text-foreground" />;
                  if (rank === 3) return <Medal className="w-5 h-5 text-orange-500" />;
                  if (prizeRanks.has(rank)) return <Award className="w-5 h-5 text-primary" />;
                  return null;
                };
                return board.map((r: any) => {
                  const isMe = r.user_id === user?.id;
                  const medal = medalFor(r.rank);
                  return (
                    <div key={r.user_id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${isMe ? "bg-amber-500/15 ring-1 ring-amber-500/40" : "bg-background/30"}`}>
                      <span className="w-8 flex items-center justify-center font-bold text-muted-foreground">
                        {medal ?? <span>#{r.rank}</span>}
                      </span>
                      {r.avatar_url
                        ? <img src={r.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                        : <div className="w-7 h-7 rounded-full bg-muted" />}
                      <span className="flex-1 truncate font-medium">
                        {isMe ? "You" : r.username}
                        {medal && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">#{r.rank}</span>}
                      </span>
                      {r.qualified && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      <span className="font-bold text-amber-400 tabular-nums">{r.total_score.toLocaleString()}</span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

function ReferralGateCard({ challengeId, userId, currentScore, gateScore, required, refUrl }: {
  challengeId: string; userId: string; currentScore: number; gateScore: number; required: number; refUrl: string;
}) {
  const { data: refCount = 0 } = useQuery({
    queryKey: ["challenge-my-referrals", challengeId, userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("challenge_referrals" as any)
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", challengeId)
        .eq("referrer_user_id", userId)
        .eq("awarded", true);
      return count || 0;
    },
  });
  const gateReached = currentScore >= gateScore;
  const met = refCount >= required;
  if (!gateReached) {
    return (
      <div className="glass-card p-4 mb-5 border border-amber-500/20">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          Milestone Advancement Score at <span className="font-semibold text-foreground">{gateScore} pts</span> — you'll need <span className="font-semibold text-foreground">{required}</span> referrals to advance past this milestone and keep playing.
        </p>
      </div>
    );
  }
  const resumePath = (() => {
    try { return localStorage.getItem(CHALLENGE_RESUME_KEY); } catch { return null; }
  })();
  return (
    <div className={`glass-card p-5 mb-5 border ${met ? "border-green-500/40" : "border-amber-500/50 bg-amber-500/5"}`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className={`w-4 h-4 ${met ? "text-green-500" : "text-amber-400"}`} />
        <h3 className="font-bold text-sm">{met ? "Milestone Advancement Cleared" : "Refer to Advance Past Milestone"}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {met
          ? `You've cleared the ${gateScore}-point Milestone Advancement Score with ${refCount}/${required} referrals. Your future games count normally.`
          : `You've reached the Milestone Advancement Score of ${currentScore} points. Games won't count until you refer ${required - refCount} more player${required - refCount === 1 ? "" : "s"} (${refCount}/${required}).`}
      </p>
      {met ? (
        <ContinuePlayingButton resumePath={resumePath} />
      ) : (
        <div className="flex gap-2">
          <input readOnly value={refUrl} className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-xs font-mono" />
          <button onClick={() => { navigator.clipboard.writeText(refUrl); toast.success("Referral link copied!"); }} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs flex items-center gap-1">
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
      )}
    </div>
  );
}

function ContinuePlayingButton({ resumePath }: { resumePath: string | null }) {
  const navigate = useNavigate();
  const go = () => {
    const target = resumePath && resumePath !== "/games/challenge" ? resumePath : "/games/songmatch";
    try { localStorage.removeItem(CHALLENGE_RESUME_KEY); } catch {}
    navigate(target);
  };
  return (
    <button
      onClick={go}
      className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-xs flex items-center justify-center gap-2"
    >
      <Play className="w-3.5 h-3.5" /> Continue Playing
    </button>
  );
}

export default Challenge;
