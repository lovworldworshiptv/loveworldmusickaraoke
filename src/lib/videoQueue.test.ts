import { describe, it, expect } from "vitest";
import { nextVideoIndex, upcomingIndices } from "./videoQueue";

const q = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("continuous video queue", () => {
  it("moves to the very next song when it has a video", () => {
    expect(nextVideoIndex(q, 0, "off", () => true)).toBe(1);
  });

  it("skips songs without a video to the next one that has one", () => {
    const withVideo = new Set(["a", "d"]);
    expect(nextVideoIndex(q, 0, "off", (id) => withVideo.has(id))).toBe(3);
  });

  it("returns -1 when no later song has a video (falls back to audio)", () => {
    const withVideo = new Set(["a"]);
    expect(nextVideoIndex(q, 0, "off", (id) => withVideo.has(id))).toBe(-1);
  });

  it("stops at the end of the queue unless repeat-all is on", () => {
    expect(upcomingIndices(4, 3, "off")).toEqual([]);
    expect(upcomingIndices(4, 3, "all")).toEqual([0, 1, 2]);
    const withVideo = new Set(["b"]);
    expect(nextVideoIndex(q, 3, "all", (id) => withVideo.has(id))).toBe(1);
  });
});
