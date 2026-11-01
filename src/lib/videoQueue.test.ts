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

describe("Up Next order", () => {
  const five = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  const has = (set: string[]) => (id: string) => set.includes(id);

  it("lists only songs that can play in Video mode, in queue order after the current one", async () => {
    const { upNextOrder } = await import("./videoQueue");
    expect(upNextOrder(five, 1, "off", has(["a", "c", "e"]))).toEqual([2, 4]);
  });

  it("repeat off stops at the end of the queue", async () => {
    const { upNextOrder } = await import("./videoQueue");
    expect(upNextOrder(five, 3, "off", () => true)).toEqual([4]);
  });

  it("repeat all wraps around to the start, never listing the playing song", async () => {
    const { upNextOrder } = await import("./videoQueue");
    expect(upNextOrder(five, 3, "all", () => true)).toEqual([4, 0, 1, 2]);
  });

  it("repeat one lists what plays when you press next (same as repeat off)", async () => {
    const { upNextOrder } = await import("./videoQueue");
    expect(upNextOrder(five, 3, "one", () => true)).toEqual([4]);
  });

  it("matches nextVideoIndex for the first entry", async () => {
    const { upNextOrder } = await import("./videoQueue");
    const withVideo = has(["b", "e"]);
    expect(upNextOrder(five, 2, "all", withVideo)[0]).toBe(nextVideoIndex(five, 2, "all", withVideo));
  });
});

describe("previous video", () => {
  const five = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  it("goes back to the closest earlier song that has a video, skipping ones without", async () => {
    const { prevVideoIndex } = await import("./videoQueue");
    expect(prevVideoIndex(five, 3, "off", (id) => id !== "c")).toBe(1);
  });
  it("stops at the start unless repeat-all is on", async () => {
    const { prevVideoIndex } = await import("./videoQueue");
    expect(prevVideoIndex(five, 0, "off", () => true)).toBe(-1);
    expect(prevVideoIndex(five, 0, "all", () => true)).toBe(4);
  });
});
