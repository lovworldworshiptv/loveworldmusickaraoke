import { describe, expect, it } from "vitest";
import { nextPlaylistOrder, orderedPlaylistEntries, playlistArtwork } from "./playlistArtwork";

describe("personal playlist rules", () => {
  const entries = [
    { id: "b", sort_order: 8, songs: { cover_url: "second.jpg" } },
    { id: "a", sort_order: 2, songs: { cover_url: "first.jpg" } },
  ];
  it("adopts the first song artwork, not stored or returned-order artwork", () => {
    expect(playlistArtwork({ cover_url: "old.jpg", playlist_songs: entries })).toBe("first.jpg");
  });
  it("follows the next song when the first is removed", () => {
    expect(playlistArtwork({ playlist_songs: entries.filter((entry) => entry.id !== "a") })).toBe("second.jpg");
  });
  it("does not substitute a later song when track one lacks artwork", () => {
    expect(playlistArtwork({ playlist_songs: [{ id: "a", sort_order: 0, songs: { cover_url: null } }, ...entries] })).toBeNull();
  });
  it("keeps official CMS artwork", () => {
    expect(playlistArtwork({ cover_url: "official.jpg", playlist_songs: entries }, false)).toBe("official.jpg");
  });
  it("appends after the highest order despite gaps left by removals", () => {
    expect(nextPlaylistOrder(entries)).toBe(9);
    expect(nextPlaylistOrder([])).toBe(0);
  });
  it("keeps all 1501 tracks in stable playlist order", () => {
    const large = Array.from({ length: 1501 }, (_, i) => ({ id: String(i), sort_order: i })).reverse();
    const sorted = orderedPlaylistEntries(large);
    expect(sorted).toHaveLength(1501);
    expect(sorted[1500].sort_order).toBe(1500);
    expect(sorted[0].sort_order).toBe(0);
  });
});