import { describe, it, expect } from "vitest";
import { canStartTrial, availablePlans } from "./trial";

const now = new Date("2026-10-28T12:00:00Z");
const plans = [{ id: "3_day_trial" }, { id: "1_month" }, { id: "6_months" }, { id: "1_year" }];

describe("free trial can only be used once", () => {
  it("a new free account can start the trial", () => {
    expect(canStartTrial({ subscription: "free", subscription_expiry_date: null, trial_used_at: null }, now)).toBe(true);
  });

  it("an account whose trial has ended cannot start another", () => {
    expect(canStartTrial({ subscription: "free", subscription_expiry_date: null, trial_used_at: "2026-10-01T00:00:00Z" }, now)).toBe(false);
  });

  it("an account currently on its trial cannot restart it", () => {
    expect(canStartTrial({ subscription: "trial", subscription_expiry_date: "2026-10-30T00:00:00Z", trial_used_at: "2026-10-27T00:00:00Z" }, now)).toBe(false);
  });

  it("an active premium account cannot start a trial", () => {
    expect(canStartTrial({ subscription: "premium", subscription_expiry_date: "2027-01-01T00:00:00Z", trial_used_at: null }, now)).toBe(false);
  });

  it("after the trial only the paid premium plans are offered", () => {
    const left = availablePlans(plans, { subscription: "free", subscription_expiry_date: null, trial_used_at: "2026-10-01T00:00:00Z" }, now);
    expect(left.map((p) => p.id)).toEqual(["1_month", "6_months", "1_year"]);
  });

  it("before the trial is used it is still offered", () => {
    expect(availablePlans(plans, { subscription: "free", subscription_expiry_date: null, trial_used_at: null }, now)).toHaveLength(4);
  });
});
