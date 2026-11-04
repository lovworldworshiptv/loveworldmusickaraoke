import { describe, it, expect } from "vitest";
import { splitArtistNames, matchArtists, slugify, type Artist } from "./artists";

const lw: Artist = { id: "1", slug: "loveworld-singers", name: "Loveworld Singers", image_url: null, cover_url: null, description: null, is_verified: true };

describe("artist names", () => {
  it("splits on commas, ampersands and feat./ft.", () => {
    expect(splitArtistNames("Loveworld Singers, Sinach & Eben feat. Ada ft. Joe"))
      .toEqual(["Loveworld Singers", "Sinach", "Eben", "Ada", "Joe"]);
  });
  it("matches case-insensitively", () => {
    expect(matchArtists("loveworld SINGERS", [lw])[0].artist?.slug).toBe("loveworld-singers");
  });
  it("leaves unmatched names unlinked", () => {
    const parts = matchArtists("Loveworld Singers, Sinach", [lw]);
    expect(parts[1]).toEqual({ name: "Sinach", artist: undefined });
  });
  it("handles empty values", () => {
    expect(splitArtistNames("")).toEqual([]);
    expect(splitArtistNames(null)).toEqual([]);
  });
  it("does not split names containing 'ft' inside a word", () => {
    expect(splitArtistNames("Swift Choir")).toEqual(["Swift Choir"]);
  });
  it("slugifies", () => { expect(slugify("Loveworld Singers!")).toBe("loveworld-singers"); });
});
