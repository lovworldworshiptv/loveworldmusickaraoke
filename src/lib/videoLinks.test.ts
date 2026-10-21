import { describe, it, expect } from "vitest";
import { isKingsSpacePage } from "./videoLinks";

describe("isKingsSpacePage", () => {
  it("flags KingsSpace watch pages, which are not playable video files", () => {
    expect(isKingsSpacePage("https://kingsspace.online/videos/watch/1884445/a-new-race-by-loveworld-singers")).toBe(true);
  });

  it("does not flag direct video files", () => {
    expect(isKingsSpacePage("https://cdnvideos.ceflix.org/processed/79523-1750020102933874468534.mp4")).toBe(false);
  });
});
