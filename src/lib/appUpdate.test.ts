import { describe, expect, it } from "vitest";
import { shouldShowUpdate } from "./appUpdate";

describe("shouldShowUpdate", () => {
  it("shows an enabled update to users who have not updated", () => {
    expect(shouldShowUpdate({ enabled: true, version: "v2" }, null)).toBe(true);
  });
  it("never shows again once the user updated to that version", () => {
    expect(shouldShowUpdate({ enabled: true, version: "v2" }, "v2")).toBe(false);
  });
  it("shows again when the admin sends a newer update", () => {
    expect(shouldShowUpdate({ enabled: true, version: "v3" }, "v2")).toBe(true);
  });
  it("stays hidden when the admin turns it off", () => {
    expect(shouldShowUpdate({ enabled: false, version: "v3" }, null)).toBe(false);
  });
});
