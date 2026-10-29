import { describe, expect, it } from "vitest";
import { listenerTierParts, premiumPlanParts, rangeDays, sumParts, type CommandCentreStats } from "./commandCentre";

const subs: CommandCentreStats["subs"] = {
  free: 1050, trial: 7, premium: 18,
  premium_1_month: 11, premium_3_months: 0, premium_6_months: 1, premium_1_year: 6, premium_other: 0,
  expired_to_free: 202, expiring_premium: 1, expiring_trial: 2,
};

describe("command centre breakdowns", () => {
  it("premium plan rows add up to the Premium total", () => {
    expect(sumParts(premiumPlanParts(subs))).toBe(18);
  });

  it("shows a plan nobody can buy only when someone is on it", () => {
    expect(premiumPlanParts(subs).map((p) => p.label)).toEqual(["1 month", "6 months", "1 year"]);
    expect(premiumPlanParts({ ...subs, premium_other: 2, premium: 20 }).map((p) => p.label)).toContain("Other plan");
  });

  it("listener plan rows add up to active listeners", () => {
    const plays = { total: 557, song: 557, karaoke: 0, video: 0, guest: 0, songs_played: 200, listeners: 40, listeners_premium: 10, listeners_trial: 2, listeners_free: 28, all_time: 1496 };
    expect(sumParts(listenerTierParts(plays))).toBe(40);
  });

  it("maps ranges to days, all time to none", () => {
    expect(rangeDays("7d")).toBe(7);
    expect(rangeDays("30d")).toBe(30);
    expect(rangeDays("all")).toBeNull();
  });
});
