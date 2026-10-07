import { Trophy, Crown, Users, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useActiveChallenge, useMyEntry, useParticipantCount, isChallengeClosed } from "@/hooks/useChallenge";
import ChallengeCountdown from "./ChallengeCountdown";
import { Button } from "@/components/ui/button";
import { TiltedGamePhoto } from "./GameHubCard";
import { resolveGameCard, type GameCardSettings } from "@/lib/gameCards";
import { hexToHsl, SETTING_KEYS, useSetting } from "@/lib/siteSettings";
import type { CSSProperties } from "react";

export default function ChallengeBanner() {
  const navigate = useNavigate();
  const { data: ch } = useActiveChallenge();
  const { data: entry } = useMyEntry(ch?.id);
  const { data: participants } = useParticipantCount(ch?.id);
  const cardSettings = useSetting<GameCardSettings>(SETTING_KEYS.gameCards);
  const presentation = resolveGameCard("challenge", cardSettings);
  if (!ch) return null;

  const dist = ch.prize_distribution || {};
  const ranks = Object.keys(dist).map(Number).sort((a, b) => a - b);
  const closed = isChallengeClosed(ch);
  const feeNum = Number(ch.entry_fee);
  const isFree = feeNum <= 0;
  const feeLabel = isFree ? "Free" : `${feeNum} Espee${feeNum === 1 ? "" : "s"}`;

  const ctaLabel = closed
    ? "Challenge Ended"
    : !entry
    ? isFree ? "Enter Challenge — Free" : `Enter Challenge — ${feeLabel}`
    : entry.status === "pending"
    ? "Entry Pending Approval"
    : entry.status === "rejected"
    ? "Entry Rejected — Try Again"
    : "You're Participating";

  return (
    <div className="game-hub-card relative rounded-2xl overflow-hidden p-5 sm:p-6 mb-6" style={{ "--game-card-background": hexToHsl(presentation.color) } as CSSProperties}>
      <TiltedGamePhoto imageUrl={presentation.imageUrl} title="Challenge" />
      <div className="relative">
        <div className="relative min-h-[150px] w-[calc(100%_-_144px)] sm:w-[calc(100%_-_160px)] pointer-events-none">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Trophy className="w-5 h-5 shrink-0 text-foreground game-icon-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Song Master Challenge</span>
          {closed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/20 text-foreground border border-foreground/40">
              <CheckCircle2 className="w-3 h-3" /> Completed
            </span>
          )}
        </div>
        <h2 className="text-xl sm:text-3xl font-serif font-bold text-foreground mb-3 break-words">{presentation.title || ch.name}</h2>
        </div>
        {(presentation.description || ch.description) && <p className="text-sm text-foreground mb-4">{presentation.description || ch.description}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-[10px] uppercase text-foreground tracking-wide">Prize Pool</p>
            <p className="text-lg font-bold text-foreground">{ch.prize_pool} Espees</p>
          </div>
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-[10px] uppercase text-foreground tracking-wide">Entry Fee</p>
            <p className="text-lg font-bold text-foreground">{feeLabel}</p>
          </div>
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-[10px] uppercase text-foreground tracking-wide flex items-center gap-1"><Users className="w-3 h-3" /> Players</p>
            <p className="text-lg font-bold text-foreground">{participants ?? 0}</p>
          </div>
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-[10px] uppercase text-foreground tracking-wide">Top Prize</p>
            <p className="text-lg font-bold text-foreground">{ranks.length ? `${dist[String(ranks[0])]} ESP` : "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          {ranks.map((r) => (
            <span key={r} className="px-2.5 py-1 rounded-full bg-background/20 border border-foreground/30 text-foreground">
              #{r} · {dist[String(r)]} ESP
            </span>
          ))}
        </div>

        <div className="mb-4">
          <p className="text-xs text-foreground text-center mb-2">{closed ? "Challenge Ended" : "Ends In"}</p>
          {!closed && <ChallengeCountdown endDate={ch.end_date} />}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => navigate(entry?.status === "approved" ? "/games/challenge" : "/games/challenge/enter")}
            disabled={closed || entry?.status === "pending"}
            className="game-card-play flex-1 h-auto py-3 rounded-full font-bold text-sm gap-2 whitespace-normal"
          >
            <Crown className="w-4 h-4" /> {ctaLabel}
          </Button>
          <Button variant="outline"
            onClick={() => navigate("/games/challenge")}
            className="flex-1 sm:flex-none h-auto py-3 px-5 rounded-full border-foreground/40 bg-background/20 text-foreground text-sm font-medium hover:bg-background/30 hover:text-foreground"
          >
            View Leaderboard
          </Button>
        </div>
      </div>
    </div>
  );
}
