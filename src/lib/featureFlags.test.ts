import { describe, it, expect } from "vitest";
import { FEATURES, featureForPath, isFeatureEnabled, HOME_FEATURES } from "./featureFlags";

describe("admin feature switches", () => {
  it("preserves existing features unless explicitly disabled", () => {
    for (const feature of FEATURES) {
      expect(isFeatureEnabled({}, feature.id)).toBe(true);
      expect(isFeatureEnabled({ [feature.id]: false }, feature.id)).toBe(false);
    }
  });
  it("disables dependent playback experiences", () => {
    for (const id of ["recording", "stories", "myKaraoke"] as const) {
      expect(isFeatureEnabled({ karaoke: false }, id)).toBe(false);
    }
    expect(isFeatureEnabled({ video: false }, "moments")).toBe(false);
    expect(isFeatureEnabled({ articles: false }, "bible")).toBe(false);
  });
  it("covers direct links and keeps admin content management available", () => {
    expect(featureForPath("/community")).toBe("community");
    expect(featureForPath("/stage")).toBe("stage");
    expect(featureForPath("/videos")).toBe("video");
    expect(featureForPath("/games/songmatch/lyrics")).toBe("games");
    expect(featureForPath("/collection/123")).toBe("playlists");
    expect(featureForPath("/admin/songs")).toBeUndefined();
    expect(featureForPath("/admin/karaoke-stories")).toBeUndefined();
    expect(featureForPath("/")).toBeUndefined();
    expect(HOME_FEATURES.videos).toBe("video");
    expect(HOME_FEATURES.karaoke).toBe("karaoke");
  });
  it("uses unique settings and preserves legacy switches", () => {
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(FEATURES.length);
    expect(FEATURES.find((f) => f.id === "recording")?.key).toBe("karaoke_record_enabled");
    expect(FEATURES.find((f) => f.id === "reminders")?.key).toBe("reminders_enabled");
  });
});