import { describe, it, expect } from "vitest";
import { pickContinuation, playableIn } from "./autoContinue";

const song = (id: string, inst = false, audio = true) => ({
  id, title: id, artist: "Loveworld Singers",
  audioUrl: audio ? `https://x/${id}.mp3` : undefined,
  instrumentalUrl: inst ? `https://x/${id}-inst.mp3` : undefined,
});

describe("continuous play: more songs for the same mode", () => {
  it("karaoke only continues with songs that have a backing track", () => {
    expect(playableIn("karaoke", song("a", false))).toBe(false);
    expect(playableIn("karaoke", song("b", true))).toBe(true);
    const picked = pickContinuation([song("a"), song("b", true), song("c", true)], [], "karaoke");
    expect(picked.map((s) => s.id).sort()).toEqual(["b", "c"]);
  });

  it("never repeats songs already in the queue", () => {
    const picked = pickContinuation([song("a"), song("b"), song("b"), song("c")], ["a"], "song");
    expect(picked.map((s) => s.id).sort()).toEqual(["b", "c"]);
  });

  it("caps how many songs are added at once", () => {
    const rows = Array.from({ length: 30 }, (_, i) => song(`s${i}`));
    expect(pickContinuation(rows, [], "video", 20)).toHaveLength(20);
  });
});
