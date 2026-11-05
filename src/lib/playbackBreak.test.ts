import { describe, it, expect } from "vitest";
import { countFinishedSong, isBreakExempt, BREAK_SECONDS } from "./playbackBreak";

describe("playback break", () => {
  it("breaks after every 2 non-free songs", () => {
    let s = countFinishedSong(0, false);
    expect(s.breakNow).toBe(false);
    s = countFinishedSong(s.count, false);
    expect(s).toEqual({ count: 0, breakNow: true });
  });
  it("free songs never count", () => {
    const s = countFinishedSong(1, true);
    expect(s).toEqual({ count: 1, breakNow: false });
  });
  it("lasts 10 seconds", () => expect(BREAK_SECONDS).toBe(10));
  it("premium, trial, editor and admin are exempt; free is not", () => {
    const base = { isPremium: false, isTrial: false, isEditor: false, isAdmin: false };
    expect(isBreakExempt(base)).toBe(false);
    for (const k of ["isPremium", "isTrial", "isEditor", "isAdmin"] as const) expect(isBreakExempt({ ...base, [k]: true })).toBe(true);
  });
});
