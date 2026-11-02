import { describe, expect, it } from "vitest";
import { preferredAudioFor } from "./preferredLanguage";

const song = { id: "s1", audioUrl: "https://cdn/en.mp3" };

describe("preferredAudioFor", () => {
  it("swaps in the ready recording in the listener's language", () => {
    const pref = { lang: "fr", audio: new Map([["s1", "https://cdn/fr.mp3"]]) };
    expect(preferredAudioFor(song, pref, true).audioUrl).toBe("https://cdn/fr.mp3");
  });

  it("keeps the original when the song has no recording in that language", () => {
    const pref = { lang: "fr", audio: new Map([["other", "https://cdn/fr.mp3"]]) };
    expect(preferredAudioFor(song, pref, true).audioUrl).toBe("https://cdn/en.mp3");
  });

  it("keeps the original for English or no preference", () => {
    const map = new Map([["s1", "https://cdn/x.mp3"]]);
    expect(preferredAudioFor(song, { lang: "en", audio: map }, true).audioUrl).toBe("https://cdn/en.mp3");
    expect(preferredAudioFor(song, { lang: null, audio: map }, true).audioUrl).toBe("https://cdn/en.mp3");
  });

  it("keeps a saved offline copy when there is no connection", () => {
    const saved = { id: "s1", audioUrl: "blob:local" };
    const pref = { lang: "fr", audio: new Map([["s1", "https://cdn/fr.mp3"]]) };
    expect(preferredAudioFor(saved, pref, false).audioUrl).toBe("blob:local");
  });
});
