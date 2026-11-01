import { describe, expect, it } from "vitest";
import { milestoneGate, prizeEligibility, readMilestones } from "../../supabase/functions/_shared/challengeMilestones.ts";

const ch = {
  qualification_min_games: 4,
  prize_min_milestones: 2,
  milestones: [{ score: 2000, invites: 5 }, { score: 1000, invites: 5 }],
};

describe("challenge milestones", () => {
  it("blocks scoring at a milestone until that many new players are invited", () => {
    const ms = readMilestones(ch);
    expect(milestoneGate(ms, 1000, 4)).toMatchObject({ blocked: true, milestoneNumber: 1, remaining: 1 });
    expect(milestoneGate(ms, 1000, 5).blocked).toBe(false);
  });

  it("needs new invites at the second milestone on top of the first", () => {
    const ms = readMilestones(ch);
    expect(milestoneGate(ms, 2000, 5)).toMatchObject({ blocked: true, milestoneNumber: 2, required: 10, remaining: 5 });
    expect(milestoneGate(ms, 2000, 10).blocked).toBe(false);
  });

  it("requires at least two milestones reached to win a prize", () => {
    expect(prizeEligibility(ch, 10, 1500).eligible).toBe(false);
    expect(prizeEligibility(ch, 10, 2000).eligible).toBe(true);
  });

  it("still requires the minimum number of games", () => {
    expect(prizeEligibility(ch, 3, 2500).eligible).toBe(false);
  });

  it("defaults to two milestones when the requirement is not set", () => {
    const legacy = { qualification_min_games: 1, milestones: [{ score: 100, invites: 1 }, { score: 200, invites: 1 }] };
    expect(prizeEligibility(legacy, 1, 150).eligible).toBe(false);
    expect(prizeEligibility(legacy, 1, 200).eligible).toBe(true);
  });
});
