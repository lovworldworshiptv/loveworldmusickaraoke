import { describe, expect, it } from "vitest";
import { buildRoleMap, countTierFilters, countUserFilters, effectiveSubscription, matchesTierFilter } from "./adminUsers";

describe("admin user counting helpers", () => {
  it("shows a person with admin and editor roles as admin, whatever the row order", () => {
    expect(buildRoleMap([{ user_id: "a", role: "editor" }, { user_id: "a", role: "admin" }]).get("a")).toBe("admin");
    expect(buildRoleMap([{ user_id: "a", role: "admin" }, { user_id: "a", role: "editor" }]).get("a")).toBe("admin");
  });

  it("counts each person once even with several role rows", () => {
    expect(buildRoleMap([{ user_id: "a", role: "admin" }, { user_id: "a", role: "editor" }, { user_id: "b", role: "user" }]).size).toBe(2);
  });

  it("treats an expired premium as free", () => {
    expect(effectiveSubscription("premium", "2020-01-01T00:00:00Z")).toBe("free");
    expect(effectiveSubscription("premium", "2999-01-01T00:00:00Z")).toBe("premium");
  });

  it("counts admins, editors, trials and each premium plan separately", () => {
    const c = countUserFilters([
      { role: "admin", subscription: "premium", subscription_plan: "1_year" },
      { role: "editor", subscription: "free", subscription_plan: "none" },
      { role: "user", subscription: "trial", subscription_plan: "3_day_trial" },
      { role: "user", subscription: "premium", subscription_plan: "1_month" },
      { role: "user", subscription: "premium", subscription_plan: "6_months" },
    ]);
    expect(c).toEqual({ all: 5, admin: 1, editor: 1, free: 1, trial: 1, premium_1_month: 1, premium_6_months: 1, premium_1_year: 1 });
  });
});

describe("subscription tier filters", () => {
  const people = [
    { subscription: "free", subscription_plan: "none" },
    { subscription: "trial", subscription_plan: "3_day_trial" },
    { subscription: "premium", subscription_plan: "1_month" },
    { subscription: "premium", subscription_plan: "3_months" },
    { subscription: "premium", subscription_plan: "6_months" },
    { subscription: "premium", subscription_plan: "1_year" },
    { subscription: "premium", subscription_plan: "1_year" },
  ];

  it("counts every premium plan once under All Premium", () => {
    expect(countTierFilters(people).premium).toBe(5);
  });

  it("counts each premium length separately, including 3 months", () => {
    const c = countTierFilters(people);
    expect([c.premium_1_month, c.premium_3_months, c.premium_6_months, c.premium_1_year]).toEqual([1, 1, 1, 2]);
  });

  it("keeps free and free trial apart from premium", () => {
    const c = countTierFilters(people);
    expect([c.all, c.free, c.trial]).toEqual([7, 1, 1]);
  });

  it("puts someone whose premium ran out under Free", () => {
    const sub = effectiveSubscription("premium", "2020-01-01T00:00:00Z");
    expect(matchesTierFilter({ subscription: sub, subscription_plan: "1_year" }, "free")).toBe(true);
    expect(matchesTierFilter({ subscription: sub, subscription_plan: "1_year" }, "premium_1_year")).toBe(false);
  });
});
