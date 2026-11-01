import { useCallback, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, Trophy, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveChallenge, useMyEntry, type Challenge } from "@/hooks/useChallenge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { prizeMilestonesRequired, readMilestones } from "../../../supabase/functions/_shared/challengeMilestones.ts";

const isRunning = (ch: Challenge | null | undefined) => {
  if (!ch || ch.status !== "active") return false;
  const now = Date.now();
  return new Date(ch.start_date).getTime() <= now && new Date(ch.end_date).getTime() >= now;
};

/** Rules for the running challenge, and whether the signed-in player is in it. */
export function useChallengeRules() {
  const { user } = useAuth();
  const { data: ch } = useActiveChallenge();
  const running = isRunning(ch) ? ch! : null;
  const { data: entry } = useMyEntry(running?.id);
  return {
    challenge: running,
    isPlayer: !!user && !!running && (entry as any)?.status === "approved",
  };
}

export function ChallengeRulesList({ challenge }: { challenge: Challenge }) {
  const milestones = readMilestones(challenge as any);
  const prizeNeed = prizeMilestonesRequired(challenge as any);
  const minGames = Number(challenge.qualification_min_games ?? 0);
  return (
    <ul className="space-y-2 text-sm leading-relaxed">
      {milestones.map((m, i) => (
        <li key={m.score} className="flex gap-2">
          <Flag aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 game-achievement-icon" />
          <span>
            <span className="font-semibold">Milestone {i + 1} — {m.score.toLocaleString()} points:</span>{" "}
            {m.invites > 0
              ? <>invite {m.invites} new player{m.invites === 1 ? "" : "s"} before more games count toward your score.</>
              : <>reach this score to complete the milestone.</>}
          </span>
        </li>
      ))}
      <li className="flex gap-2">
        <Trophy aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 game-achievement-icon" />
        <span>
          <span className="font-semibold">To win a prize:</span>{" "}
          {prizeNeed > 0 && <>reach at least {prizeNeed} milestone{prizeNeed === 1 ? "" : "s"}</>}
          {prizeNeed > 0 && minGames > 0 && <> and </>}
          {minGames > 0 && <>play at least {minGames} counted game{minGames === 1 ? "" : "s"}</>}
          {prizeNeed === 0 && minGames === 0 && <>finish in a prize position</>}.
        </span>
      </li>
    </ul>
  );
}

/** Permanent (non-dismissable) rules notice for game heroes. */
export function ChallengeRulesNotice({ audience = "players", className = "" }: { audience?: "players" | "everyone"; className?: string }) {
  const { challenge, isPlayer } = useChallengeRules();
  if (!challenge) return null;
  if (audience === "players" && !isPlayer) return null;
  return (
    <section aria-label="Challenge rules" className={`challenge-arcade challenge-referral game-tone-amber rounded-2xl p-4 text-left ${className}`}>
      <p className="flex items-center gap-2 text-xs font-bold uppercase mb-2">
        <UserPlus aria-hidden="true" className="w-4 h-4 game-achievement-icon" /> Song Master Challenge rules
      </p>
      <ChallengeRulesList challenge={challenge} />
    </section>
  );
}

// ---- Start-of-game rules prompt -------------------------------------------
let pendingStart: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getOpen = () => pendingStart !== null;

/** Wraps a game's start so challenge players see the rules before every game. */
export function useChallengeRulesStart() {
  const { challenge, isPlayer } = useChallengeRules();
  return useCallback((start: () => void) => {
    if (!challenge || !isPlayer) { start(); return; }
    pendingStart = start;
    emit();
  }, [challenge, isPlayer]);
}

export function ChallengeRulesPromptHost() {
  const open = useSyncExternalStore(subscribe, getOpen, getOpen);
  const { challenge } = useChallengeRules();
  const navigate = useNavigate();
  const close = () => { pendingStart = null; emit(); };
  const begin = () => { const fn = pendingStart; close(); fn?.(); };
  if (!challenge) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="challenge-arcade game-tone-amber max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 game-achievement-icon" /> Before you play</DialogTitle>
          <DialogDescription>Song Master Challenge rules for this game.</DialogDescription>
        </DialogHeader>
        <ChallengeRulesList challenge={challenge} />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => { close(); navigate("/games/challenge/referrals"); }}
            className="challenge-arcade-cta game-tone-amber">
            <UserPlus className="w-4 h-4" /> Invite players
          </Button>
          <Button onClick={begin}>I understand — start game</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
