import { describe, it, expect } from "vitest";
import { moveItem, removeItem, playNextItem, insertItem } from "./queueOps";

const q = ["a", "b", "c", "d", "e"];

describe("moveItem (reorderQueue)", () => {
  it("moves a later song further down without changing the playing song", () => {
    expect(moveItem(q, 1, 2, 4)).toEqual({ queue: ["a", "b", "d", "e", "c"], index: 1 });
  });
  it("moving a song from before the playing one to after it shifts the playing position back", () => {
    expect(moveItem(q, 2, 0, 4)).toEqual({ queue: ["b", "c", "d", "e", "a"], index: 1 });
  });
  it("moving a song from after the playing one to before it shifts the playing position forward", () => {
    expect(moveItem(q, 2, 4, 0)).toEqual({ queue: ["e", "a", "b", "c", "d"], index: 3 });
  });
  it("does nothing for the same position or an invalid index", () => {
    expect(moveItem(q, 1, 3, 3)).toBeNull();
    expect(moveItem(q, 1, 9, 0)).toBeNull();
  });
});

describe("removeItem (removeFromQueue)", () => {
  it("removing a later song keeps the playing position", () => {
    expect(removeItem(q, 1, 3)).toEqual({ queue: ["a", "b", "c", "e"], index: 1 });
  });
  it("removing an earlier song moves the playing position back by one", () => {
    expect(removeItem(q, 3, 0)).toEqual({ queue: ["b", "c", "d", "e"], index: 2 });
  });
  it("never removes the song that is playing", () => {
    expect(removeItem(q, 2, 2)).toBeNull();
  });
});

describe("playNextItem (playNextInQueue)", () => {
  it("puts a later song straight after the playing one", () => {
    const r = playNextItem(q, 1, 4)!;
    expect(r).toEqual({ queue: ["a", "b", "e", "c", "d"], index: 1 });
    expect(r.queue[r.index]).toBe("b");
    expect(r.queue[r.index + 1]).toBe("e");
  });
  it("puts an earlier song straight after the playing one", () => {
    const r = playNextItem(q, 3, 0)!;
    expect(r).toEqual({ queue: ["b", "c", "d", "a", "e"], index: 2 });
    expect(r.queue[r.index]).toBe("d");
    expect(r.queue[r.index + 1]).toBe("a");
  });
  it("does nothing when the song is already next or is the playing one", () => {
    expect(playNextItem(q, 1, 2)).toBeNull();
    expect(playNextItem(q, 1, 1)).toBeNull();
  });
});

describe("insertItem (Undo)", () => {
  it("undoing a removal before the playing song restores the original queue and position", () => {
    const removed = removeItem(q, 3, 1)!;
    expect(insertItem(removed.queue, removed.index, "b", 1)).toEqual({ queue: q, index: 3 });
  });
  it("undoing a removal after the playing song keeps the playing position", () => {
    const removed = removeItem(q, 1, 3)!;
    expect(insertItem(removed.queue, removed.index, "d", 3)).toEqual({ queue: q, index: 1 });
  });
});

describe("video shuffle", () => {
  it("shuffles only the songs after the playing one and keeps it current", async () => {
    const { shuffleAfter } = await import("./queueOps");
    const seq = [0.1, 0.9, 0.5, 0.3];
    let n = 0;
    const r = shuffleAfter(q, 1, () => seq[n++ % seq.length])!;
    expect(r.index).toBe(1);
    expect(r.queue.slice(0, 2)).toEqual(["a", "b"]);
    expect([...r.queue.slice(2)].sort()).toEqual(["c", "d", "e"]);
  });
  it("turning shuffle off restores the earlier order, keeping newly added songs at the end", async () => {
    const { restoreAfter } = await import("./queueOps");
    const r = restoreAfter(["a", "b", "e", "x", "c", "d"], 1, q, (s) => s)!;
    expect(r).toEqual({ queue: ["a", "b", "c", "d", "e", "x"], index: 1 });
  });
});
