import { describe, expect, it } from "vitest";
import { listenerTierParts, parseRangeDays, premiumPlanParts, rangeLabel, sumParts, type CommandCentreStats } from "./commandCentre";

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

  it("accepts a typed number of days from 1 to 3,650 only", () => {
    expect(parseRangeDays("14")).toBe(14);
    expect(parseRangeDays("1")).toBe(1);
    expect(parseRangeDays("3650")).toBe(3650);
    expect(parseRangeDays("0")).toBeNull();
    expect(parseRangeDays("3651")).toBeNull();
    expect(parseRangeDays("2.5")).toBeNull();
    expect(parseRangeDays("-3")).toBeNull();
  });

  it("labels the window", () => {
    expect(rangeLabel(14)).toBe("last 14 days");
    expect(rangeLabel(1)).toBe("last 24 hours");
    expect(rangeLabel(null)).toBe("all time");
  });
});
