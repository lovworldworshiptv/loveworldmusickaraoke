// Shared Song Master Challenge milestone rules. Pure TypeScript with no
// imports so the app and the backend functions use the exact same logic.

export type ChallengeMilestone = { score: number; invites: number };

export type MilestoneChallenge = {
  milestones?: unknown;
  prize_min_milestones?: number | null;
  qualification_min_games?: number | null;
  referral_gate_score?: number | null;
  referral_gate_required_invites?: number | null;
};

export const DEFAULT_PRIZE_MIN_MILESTONES = 2;

/** Milestones sorted by score; falls back to the older single-milestone fields. */
export function readMilestones(ch: MilestoneChallenge | null | undefined): ChallengeMilestone[] {
  if (!ch) return [];
  const raw = Array.isArray(ch.milestones) ? ch.milestones : [];
  let list: ChallengeMilestone[] = raw
    .map((m: any) => ({ score: Number(m?.score), invites: Math.max(0, Math.floor(Number(m?.invites) || 0)) }))
    .filter((m) => Number.isFinite(m.score) && m.score > 0);
  if (list.length === 0 && ch.referral_gate_score != null && Number(ch.referral_gate_score) > 0) {
    list = [{ score: Number(ch.referral_gate_score), invites: Math.max(0, Number(ch.referral_gate_required_invites) || 0) }];
  }
  list.sort((a, b) => a.score - b.score);
  return list.filter((m, i) => i === 0 || m.score !== list[i - 1].score);
}

/** How many milestones must be reached to win a prize (0 when none are set). */
export function prizeMilestonesRequired(ch: MilestoneChallenge | null | undefined): number {
  if (readMilestones(ch).length === 0) return 0;
  const n = ch?.prize_min_milestones;
  return n == null ? DEFAULT_PRIZE_MIN_MILESTONES : Math.max(0, Math.floor(Number(n)));
}

export function milestonesReached(milestones: ChallengeMilestone[], totalScore: number): number {
  return milestones.filter((m) => totalScore >= m.score).length;
}

/**
 * Invite gate. Each milestone's invites are new invites on top of the earlier
 * milestones, so passing milestone N needs the sum of invites for 1..N.
 */
export function milestoneGate(milestones: ChallengeMilestone[], totalScore: number, invitesDone: number) {
  let needed = 0;
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    if (totalScore < m.score) break;
    needed += m.invites;
    if (invitesDone < needed) {
      return {
        blocked: true,
        milestoneNumber: i + 1,
        milestoneScore: m.score,
        required: needed,
        remaining: needed - invitesDone,
      };
    }
  }
  return { blocked: false, milestoneNumber: 0, milestoneScore: 0, required: needed, remaining: 0 };
}

/** Prize eligibility: enough counted games AND enough milestones reached. */
export function prizeEligibility(ch: MilestoneChallenge, gamesPlayed: number, totalScore: number) {
  const minGames = Number(ch.qualification_min_games ?? 10);
  const milestones = readMilestones(ch);
  const milestonesNeeded = prizeMilestonesRequired(ch);
  const reached = milestonesReached(milestones, totalScore);
  return {
    eligible: gamesPlayed >= minGames && reached >= milestonesNeeded,
    minGames,
    gamesLeft: Math.max(0, minGames - gamesPlayed),
    milestonesNeeded,
    milestonesReached: reached,
    milestonesLeft: Math.max(0, milestonesNeeded - reached),
  };
}
