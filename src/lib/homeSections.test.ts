import { describe, it, expect } from "vitest";
import { curatedOrder, sectionText } from "./homeSections";

const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("curatedOrder", () => {
  it("shows only the admin's picks, in the admin's order", () => {
    expect(curatedOrder(rows, ["c", "a"]).map((r) => r.id)).toEqual(["c", "a"]);
  });
  it("uses the automatic list when the admin picked nothing", () => {
    expect(curatedOrder(rows, []).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("skips picks that are no longer available", () => {
    expect(curatedOrder(rows, ["x", "b"]).map((r) => r.id)).toEqual(["b"]);
  });
  it("falls back to the automatic list when no pick is available", () => {
    expect(curatedOrder(rows, ["x"]).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("sectionText", () => {
  it("uses the admin's title", () => {
    expect(sectionText({ quick_picks: { title: "Sing Now" } }, "quick_picks").title).toBe("Sing Now");
  });
  it("keeps the built-in title when the admin clears it", () => {
    expect(sectionText({ quick_picks: { title: "  " } }, "quick_picks").title).toBe("Quick Picks");
  });
  it("hides the small heading when the admin clears it", () => {
    expect(sectionText({ recommendations: { eyebrow: "" } }, "recommendations").eyebrow).toBe("");
  });
  it("shows the built-in small heading when nothing is saved", () => {
    expect(sectionText(null, "karaoke").eyebrow).toBe("Sing along");
  });
});
