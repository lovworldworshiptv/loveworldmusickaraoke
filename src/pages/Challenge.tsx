import { useEffect, type CSSProperties } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveChallenge, useMyEntry, useMyScore, useLeaderboard, buildReferralUrl } from "@/hooks/useChallenge";
import { CHALLENGE_RESUME_KEY } from "@/hooks/useReferralGateGuard";
import ChallengeCountdown from "@/components/games/ChallengeCountdown";
import { Trophy, Copy, ArrowLeft, Crown, Target, CheckCircle, LogOut, AlertCircle, Medal, Award, Play, Gamepad2, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsPremium } from "@/hooks/useIsPremium";
import { Button } from "@/components/ui/button";
import { TiltedGamePhoto } from "@/components/games/GameHubCard";
import { GAME_CARD_DEFAULTS, resolveGameCard, type GameCardSettings } from "@/lib/gameCards";
import { hexToHsl, SETTING_KEYS, useSetting } from "@/lib/siteSettings";


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
  const cardSettings = useSetting<GameCardSettings>(SETTING_KEYS.gameCards);
  const presentation = resolveGameCard("challenge", cardSettings);


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
    if (!entry || !ch || !user) return;
    if (!confirm("Leave this challenge? Your entry and progress will be removed and any entry fee is not refunded.")) return;
    const { error } = await supabase.from("challenge_entries" as any).delete().eq("id", entry.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("challenge_scores" as any).delete().eq("challenge_id", ch.id).eq("user_id", user.id);
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

        <section aria-label="Song Master Challenge" className="game-hub-card challenge-detail-card relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-5"
          style={{ "--game-card-background": hexToHsl(presentation.color) } as CSSProperties}>
          <TiltedGamePhoto imageUrl={presentation.imageUrl} fallbackImageUrl={GAME_CARD_DEFAULTS.challenge.imageUrl} title="Challenge" />
          <div className="relative min-h-[150px] w-[calc(100%_-_144px)] sm:w-[calc(100%_-_160px)] pointer-events-none">
            <div className="flex items-start gap-2 mb-2">
              <Trophy className="w-5 h-5 shrink-0 text-foreground game-icon-pulse" />
              <span className="text-xs font-bold uppercase text-foreground">Song Master Challenge</span>
            </div>
          </div>
          <h1 className="relative text-2xl font-serif font-bold mb-3 break-words">{ch.name}</h1>
          {ch.description && <p className="relative text-sm text-foreground mb-5">{ch.description}</p>}
          <div className="challenge-detail-countdown relative">
            <div className="mb-2 text-xs text-center text-foreground">Ends In</div>
            <ChallengeCountdown endDate={ch.end_date} />
          </div>
        </section>

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
          <section className="challenge-arcade challenge-progress p-5 mb-5" aria-label="Your Progress">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Target className="w-4 h-4 challenge-current-icon game-icon-pulse" /> Your Progress</h3>
            <div className="grid grid-cols-3 text-center">
              <div className="challenge-progress-column game-tone-cyan"><Medal aria-hidden="true" className="w-5 h-5 mx-auto mb-2 game-achievement-icon game-icon-float" /><p className="text-2xl font-bold tabular-nums game-achievement-icon">#{myRow?.rank ?? "—"}</p><p className="text-xs mt-1">Rank</p></div>
              <div className="challenge-progress-column game-tone-amber"><Sparkles aria-hidden="true" className="w-5 h-5 mx-auto mb-2 game-achievement-icon game-icon-pulse" /><p className="text-2xl font-bold tabular-nums game-achievement-icon">{myScore?.total_score ?? 0}</p><p className="text-xs mt-1">Points</p></div>
              <div className="challenge-progress-column game-tone-rose"><Gamepad2 aria-hidden="true" className="w-5 h-5 mx-auto mb-2 game-achievement-icon game-controller" /><p className="text-2xl font-bold tabular-nums game-achievement-icon">{myScore?.games_played ?? 0}</p><p className="text-xs mt-1">Games</p></div>
            </div>
            <div className="mt-4 text-center">
              {myScore?.qualified
                ? <span className="challenge-qualified inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Qualified</span>
                : <span className="text-xs">Participating — {Math.max(0, (ch.qualification_min_games - (myScore?.games_played || 0)))} more games to qualify</span>}
            </div>
          </section>
        )}

        {user && entry?.status === "approved" && ch.referral_gate_score != null && (ch.referral_gate_required_invites ?? 0) > 0 && (
          <ReferralGateCard
            challengeId={ch.id}
            userId={user.id}
            currentScore={myScore?.total_score ?? 0}
            gateScore={Number(ch.referral_gate_score)}
            required={Number(ch.referral_gate_required_invites)}
            refUrl={refUrl}
          />
        )}

        {/* Referral link card removed per product request; +50pts per referral logic still active. */}

        {entry && (
          <Button variant="outline" onClick={leaveChallenge}
            className="challenge-arcade-cta game-tone-rose w-full h-auto min-h-12 mb-5 py-3 rounded-xl text-sm font-semibold gap-2">
            <LogOut className="w-3.5 h-3.5" /> Leave Challenge
          </Button>
        )}

        {!entry && (
          <button onClick={() => navigate("/games/challenge/enter")}
            className="w-full mb-5 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2">
            <Crown className="w-4 h-4" /> Enter Challenge — {Number(ch.entry_fee) <= 0 ? "Free" : `${ch.entry_fee} Espee${Number(ch.entry_fee) === 1 ? "" : "s"}`}
          </button>
        )}

        <section className="challenge-arcade challenge-leaderboard" aria-label="Live Leaderboard">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Trophy aria-hidden="true" className="w-5 h-5 game-tone-amber game-achievement-icon game-icon-float" /> Live Leaderboard</h3>
          {board.length === 0 ? (
            <p className="text-sm text-center py-6">No players yet. Be the first!</p>
          ) : (
            <ol className="space-y-2.5">
              {(() => {
                const dist = (ch.prize_distribution || {}) as Record<string, number>;
                const prizeRanks = new Set(Object.keys(dist).filter(k => Number(dist[k]) > 0).map(k => Number(k)));
                const medalFor = (rank: number) => {
                  if (rank === 1) return <Trophy aria-hidden="true" className="w-4 h-4 game-icon-float" />;
                  if (rank === 2 || rank === 3) return <Medal aria-hidden="true" className="w-4 h-4 game-icon-float" />;
                  if (prizeRanks.has(rank)) return <Award aria-hidden="true" className="w-4 h-4 game-icon-pulse" />;
                  return null;
                };
                return board.map((r: any) => {
                  const isMe = r.user_id === user?.id;
                  const medal = medalFor(r.rank);
                  return (
                    <li key={r.user_id} aria-current={isMe ? "true" : undefined}
                      className={`challenge-rank-row ${isMe ? "challenge-rank-current game-tone-cyan" : r.rank === 1 ? "game-tone-amber" : r.rank === 2 ? "game-tone-blue" : r.rank === 3 ? "game-tone-rose" : r.rank % 2 === 0 ? "game-tone-green" : "game-tone-purple"} flex items-center gap-2 sm:gap-3 px-3 py-3 rounded-xl text-sm`}>
                      <span className="challenge-rank-badge shrink-0 flex flex-col items-center justify-center font-bold text-xs">
                        {medal}<span>#{r.rank}</span>
                      </span>
                      {r.avatar_url
                        ? <img src={r.avatar_url} className="challenge-rank-avatar w-8 h-8 shrink-0 rounded-full object-cover" alt="" loading="lazy" />
                        : <span className="challenge-rank-avatar w-8 h-8 shrink-0 rounded-full flex items-center justify-center"><UserRound aria-hidden="true" className="w-4 h-4" /></span>}
                      <span className="flex-1 min-w-0 font-semibold">
                        <span className="block truncate">{isMe ? "You" : r.username}</span>
                        {isMe && <span className="challenge-current-label block text-[10px] font-semibold">Current Position</span>}
                      </span>
                      <span className="challenge-rank-score shrink-0 flex items-center gap-1.5 font-bold tabular-nums">
                        {r.qualified && <CheckCircle aria-label="Qualified" className="w-3.5 h-3.5 challenge-qualified-icon" />}
                        {r.total_score.toLocaleString()}
                      </span>
                    </li>
                  );
                });
              })()}
            </ol>
          )}
        </section>
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
      <section aria-label="Referral notification" className="challenge-arcade challenge-referral game-tone-amber p-5 mb-5 rounded-2xl">
        <p className="text-sm leading-relaxed">
          <AlertCircle aria-hidden="true" className="inline-block align-middle w-5 h-5 mr-2 game-achievement-icon game-icon-pulse" />
          Milestone Advancement Score at <span className="font-semibold text-foreground">{gateScore} pts</span> — you'll need <span className="font-semibold text-foreground">{required}</span> referrals to advance past this milestone and keep playing.
        </p>
      </section>
    );
  }
  const resumePath = (() => {
    try { return localStorage.getItem(CHALLENGE_RESUME_KEY); } catch { return null; }
  })();
  return (
    <section aria-label="Referral notification" className={`challenge-arcade challenge-referral p-5 mb-5 rounded-2xl ${met ? "game-tone-green" : "game-tone-amber"}`}>
      <div className="flex items-start gap-2 mb-3">
        <AlertCircle className="w-5 h-5 shrink-0 game-achievement-icon game-icon-pulse" />
        <h3 className="font-bold text-sm">{met ? "Milestone Advancement Cleared" : "Refer to Advance Past Milestone"}</h3>
      </div>
      <p className="text-sm leading-relaxed mb-4">
        {met
          ? `You've cleared the ${gateScore}-point Milestone Advancement Score with ${refCount}/${required} referrals. Your future games count normally.`
          : `You've reached the Milestone Advancement Score of ${currentScore} points. Games won't count until you refer ${required - refCount} more player${required - refCount === 1 ? "" : "s"} (${refCount}/${required}).`}
      </p>
      {met ? (
        <ContinuePlayingButton resumePath={resumePath} />
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input aria-label="Referral link" readOnly value={refUrl} className="min-w-0 w-full flex-1 px-3 py-2 rounded-lg bg-background/40 border border-foreground/20 text-foreground text-xs font-mono" />
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(refUrl); toast.success("Referral link copied!"); }} className="challenge-arcade-cta game-tone-amber h-auto min-h-11 px-4 py-2 text-sm gap-2">
            <Copy className="w-3 h-3" /> Copy
          </Button>
        </div>
      )}
    </section>
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
    <Button variant="outline"
      onClick={go}
      className="challenge-arcade-cta game-tone-green w-full h-auto min-h-11 py-3 rounded-xl font-semibold text-sm gap-2"
    >
      <Play className="w-3.5 h-3.5" /> Continue Playing
    </Button>
  );
}

export default Challenge;
