import { Trophy, Crown, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useActiveChallenge, useMyEntry, useParticipantCount } from "@/hooks/useChallenge";
import ChallengeCountdown from "./ChallengeCountdown";

export default function ChallengeBanner() {
  const navigate = useNavigate();
  const { data: ch } = useActiveChallenge();
  const { data: entry } = useMyEntry(ch?.id);
  const { data: participants } = useParticipantCount(ch?.id);
  if (!ch) return null;

  const dist = ch.prize_distribution || {};
  const ranks = Object.keys(dist).map(Number).sort((a, b) => a - b);

  const ctaLabel = !entry
    ? `Enter Challenge — ${ch.entry_fee} Espee${Number(ch.entry_fee) === 1 ? "" : "s"}`
    : entry.status === "pending"
    ? "Entry Pending Approval"
    : entry.status === "rejected"
    ? "Entry Rejected — Try Again"
    : "You're Participating";

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-amber-700/20 border border-amber-500/30 p-5 sm:p-6 mb-6 shadow-[0_8px_40px_-12px_rgba(251,191,36,0.4)]">
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Song Match Challenge</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground mb-1">{ch.name}</h2>
        {ch.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{ch.description}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Prize Pool</p>
            <p className="text-lg font-bold text-amber-400">{ch.prize_pool} Espees</p>
          </div>
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Entry Fee</p>
            <p className="text-lg font-bold text-foreground">{ch.entry_fee} Espee</p>
          </div>
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide flex items-center gap-1"><Users className="w-3 h-3" /> Players</p>
            <p className="text-lg font-bold text-foreground">{participants ?? 0}</p>
          </div>
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Top Prize</p>
            <p className="text-lg font-bold text-foreground">{ranks.length ? `${dist[String(ranks[0])]} ESP` : "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          {ranks.map((r) => (
            <span key={r} className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
              {r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`} {dist[String(r)]} ESP
            </span>
          ))}
        </div>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground text-center mb-2">Ends In</p>
          <ChallengeCountdown endDate={ch.end_date} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => navigate(entry?.status === "approved" ? "/games/challenge" : "/games/challenge/enter")}
            disabled={entry?.status === "pending"}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" /> {ctaLabel}
          </button>
          <button
            onClick={() => navigate("/games/challenge")}
            className="flex-1 sm:flex-none py-3 px-5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
          >
            View Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
