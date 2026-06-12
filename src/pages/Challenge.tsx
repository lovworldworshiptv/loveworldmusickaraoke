import { useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveChallenge, useMyEntry, useMyScore, useLeaderboard, buildReferralUrl } from "@/hooks/useChallenge";
import ChallengeCountdown from "@/components/games/ChallengeCountdown";
import { Trophy, Copy, ArrowLeft, Crown, Target, CheckCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";


const Challenge = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { data: ch } = useActiveChallenge();
  const { data: entry, refetch: refetchEntry } = useMyEntry(ch?.id);
  const { data: myScore } = useMyScore(ch?.id);
  const { data: board = [] } = useLeaderboard(ch?.id);


  // Capture ?ref= referrer to localStorage
  useEffect(() => {
    const ref = params.get("ref");
    if (ref && ref !== user?.id) localStorage.setItem("challenge_ref", ref);
  }, [params, user?.id]);

  if (!ch) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-6 pb-8 max-w-2xl mx-auto text-center">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-2xl font-serif font-bold mb-2">No Active Challenge</h1>
          <p className="text-muted-foreground text-sm mb-6">There's no Song Match Challenge running right now. Check back soon!</p>
          <button onClick={() => navigate("/games")} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm">Back to Games</button>
        </div>
      </AppLayout>
    );
  }

  const myRow = board.find((r: any) => r.user_id === user?.id);
  const refUrl = user ? buildReferralUrl(user.id) : "";

  const copyRef = () => {
    if (!refUrl) return;
    navigator.clipboard.writeText(refUrl);
    toast.success("Referral link copied!");
  };

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
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Song Match Challenge</span>
          </div>
          <h1 className="text-2xl font-serif font-bold mb-1">{ch.name}</h1>
          {ch.description && <p className="text-sm text-muted-foreground mb-4">{ch.description}</p>}
          <div className="mb-2 text-xs text-center text-muted-foreground">Ends In</div>
          <ChallengeCountdown endDate={ch.end_date} />
        </div>

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

        {entry?.status === "approved" && (
          <div className="glass-card p-5 mb-5">
            <h3 className="font-bold mb-2">Your Referral Link</h3>
            <p className="text-xs text-muted-foreground mb-3">Earn +50 points for each new player who joins through your link.</p>
            <div className="flex gap-2">
              <input readOnly value={refUrl} className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-xs font-mono" />
              <button onClick={copyRef} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
            </div>
          </div>
        )}

        {!entry && (
          <button onClick={() => navigate("/games/challenge/enter")}
            className="w-full mb-5 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2">
            <Crown className="w-4 h-4" /> Enter Challenge — {ch.entry_fee} Espee
          </button>
        )}

        <div className="glass-card p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Live Leaderboard</h3>
          {board.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No players yet. Be the first!</p>
          ) : (
            <div className="space-y-1.5">
              {board.map((r: any) => {
                const isMe = r.user_id === user?.id;
                return (
                  <div key={r.user_id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${isMe ? "bg-amber-500/15 ring-1 ring-amber-500/40" : "bg-background/30"}`}>
                    <span className="w-8 text-center font-bold text-muted-foreground">#{r.rank}</span>
                    {r.avatar_url
                      ? <img src={r.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                      : <div className="w-7 h-7 rounded-full bg-muted" />}
                    <span className="flex-1 truncate font-medium">{isMe ? "You" : r.username}</span>
                    {r.qualified && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                    <span className="font-bold text-amber-400 tabular-nums">{r.total_score.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Challenge;
