import { describe, expect, it } from "vitest";
import {
  BUILT_IN_STAGE_BACKGROUNDS, DEFAULT_STAGE_FONT, filterStageChoices, moveStageChoice, resolveStageFont, STAGE_FONTS, stageLibrary,
} from "./stageBackgrounds";

describe("Stage Mode backgrounds", () => {
  it("ships ocean, mountain and dunes as both motion and still", () => {
    const motion = BUILT_IN_STAGE_BACKGROUNDS.filter((c) => c.mediaType === "video").map((c) => c.name);
    const still = BUILT_IN_STAGE_BACKGROUNDS.filter((c) => c.mediaType === "image").map((c) => c.name);
    expect(motion).toEqual(["Ocean sunset", "Mountain clouds (drone)", "Sand dunes"]);
    expect(still).toEqual(["Ocean sunset", "Mountain clouds (drone)", "Sand dunes"]);
  });

  it("uses the starter set until the admin saves a library, then only the admin's list", () => {
    expect(stageLibrary(null)).toHaveLength(6);
    expect(stageLibrary({ backgroundLibrary: [] })).toHaveLength(0);
    const own = [{ id: "a", name: "Admin upload", backgroundColor: "#000", mediaType: "video" as const, mediaUrl: "https://x/a.mp4" }];
    expect(stageLibrary({ backgroundLibrary: own })).toEqual(own);
  });

  it("splits choices into Motion, Still and This song tabs", () => {
    const choices = [{ id: "song", mediaType: "none" }, { id: "artwork", mediaType: "image" }, ...BUILT_IN_STAGE_BACKGROUNDS];
    expect(filterStageChoices(choices, "motion").map((c) => c.id)).toEqual(["builtin-ocean-motion", "builtin-mountain-motion", "builtin-dunes-motion"]);
    expect(filterStageChoices(choices, "still")).toHaveLength(3);
    expect(filterStageChoices(choices, "song").map((c) => c.id)).toEqual(["song", "artwork"]);
    expect(filterStageChoices(choices, "all")).toHaveLength(8);
  });

  it("reorders library items", () => {
    const moved = moveStageChoice(BUILT_IN_STAGE_BACKGROUNDS, "builtin-dunes-motion", "builtin-ocean-motion");
    expect(moved[0].id).toBe("builtin-dunes-motion");
  });
});

describe("Stage Mode fonts", () => {
  it("offers six fonts and falls back to the default for unknown choices", () => {
    expect(STAGE_FONTS).toHaveLength(6);
    expect(resolveStageFont("cinzel").name).toBe("Cinzel");
    expect(resolveStageFont("missing")).toBe(DEFAULT_STAGE_FONT);
  });
});
