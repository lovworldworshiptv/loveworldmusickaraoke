import { describe, it, expect } from "vitest";
import { cleanVoiceQuery, downsample, bestLyricLines } from "./voiceSearch";

describe("cleanVoiceQuery", () => {
  it("drops spoken commands around a title", () => {
    expect(cleanVoiceQuery("Play Way Maker please.")).toBe("Way Maker");
    expect(cleanVoiceQuery("Search for the song How Great You Are")).toBe("How Great You Are");
    expect(cleanVoiceQuery("Glorious King Enthroned by Loveworld Singers")).toBe("Glorious King Enthroned");
  });
  it("keeps a sung lyric line as it is", () => {
    expect(cleanVoiceQuery("You are the lifter of my head and keeper")).toBe("You are the lifter of my head and keeper");
  });
});

describe("downsample", () => {
  it("converts 48 kHz audio to 16 kHz (one third the samples)", () => {
    expect(downsample(new Float32Array(48000), 48000).length).toBe(16000);
  });
});

describe("bestLyricLines", () => {
  it("returns the lines that match the spoken phrase", () => {
    const lyrics = "The Lord is mighty in this place\nHis presence is here right now\nIn His name, you will be healed";
    expect(bestLyricLines(lyrics, "his presence is here right now")).toBe("His presence is here right now / In His name, you will be healed");
  });
});
