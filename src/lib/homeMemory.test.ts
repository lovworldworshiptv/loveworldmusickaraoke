import { beforeEach, describe, expect, it } from "vitest";
import { heightKey, rememberHeight, rememberedHeight, resetHomeMemory } from "./homeMemory";

describe("home section height memory", () => {
  beforeEach(() => { localStorage.clear(); resetHomeMemory(); });

  it("remembers a section's height so its space is held on the next visit", () => {
    rememberHeight("videos", 312.4, 400);
    resetHomeMemory(); // simulate reopening the app
    expect(rememberedHeight("videos", 400)).toBe(312);
  });

  it("keeps phone and desktop heights apart", () => {
    rememberHeight("videos", 300, 390);
    rememberHeight("videos", 420, 1280);
    expect(rememberedHeight("videos", 390)).toBe(300);
    expect(rememberedHeight("videos", 1280)).toBe(420);
    expect(heightKey("videos", 390)).not.toBe(heightKey("videos", 1280));
  });

  it("holds no space for a section it has never seen", () => {
    expect(rememberedHeight("articles", 390)).toBe(0);
  });
});
