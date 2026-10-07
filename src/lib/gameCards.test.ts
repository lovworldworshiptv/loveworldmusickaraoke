import { describe, expect, it } from "vitest";
import { GAME_CARD_DEFAULTS, resolveGameCard } from "./gameCards";

describe("game hub card presentation", () => {
  it("uses relevant photo and bright defaults when no CMS entry exists", () => {
    expect(resolveGameCard("songmatch")).toEqual(GAME_CARD_DEFAULTS.songmatch);
    expect(resolveGameCard("articles").imageUrl).toBeTruthy();
  });
  it("preserves admin title, description, photo and colour independently", () => {
    expect(resolveGameCard("articles", { articles: { title: "Read & Play", description: "Article challenge", imageUrl: "https://example.org/photo.jpg", color: "#123456" } })).toEqual({ title: "Read & Play", description: "Article challenge", imageUrl: "https://example.org/photo.jpg", color: "#123456" });
  });
  it("falls back safely for blank fields and invalid colours", () => {
    expect(resolveGameCard("songmatch", { songmatch: { title: " ", color: "invalid", imageUrl: "" } })).toEqual(GAME_CARD_DEFAULTS.songmatch);
  });
});