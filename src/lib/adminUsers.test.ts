import { describe, expect, it } from "vitest";
import { buildRoleMap, effectiveSubscription } from "./adminUsers";

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
});
