import { describe, expect, it } from "vitest";
import { buildRoleMap, countUserFilters, effectiveSubscription } from "./adminUsers";

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
