import { describe, it, expect } from "vitest";
import { cardCacheKey } from "./shareCardCache";

const base = { kind: "song", id: "abc", style: "glass", format: "story", title: "Holy", subtitle: "Loveworld Singers", coverUrl: "x.jpg", link: "https://loveworldmusickaraoke.com/s" };

describe("cardCacheKey", () => {
  it("reuses the same card for the same request", () => {
    expect(cardCacheKey(base)).toBe(cardCacheKey({ ...base }));
  });
  it("makes a new card when the style, shape or artwork changes", () => {
    expect(cardCacheKey({ ...base, style: "arch" })).not.toBe(cardCacheKey(base));
    expect(cardCacheKey({ ...base, format: "square" })).not.toBe(cardCacheKey(base));
    expect(cardCacheKey({ ...base, coverUrl: "y.jpg" })).not.toBe(cardCacheKey(base));
  });
});
