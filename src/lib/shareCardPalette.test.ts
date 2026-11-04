import { describe, it, expect } from "vitest";
import { DEFAULT_PALETTE, contrastRatio, dominantArtworkColor, paletteFromPixels, rgbToHsl } from "./shareCardPalette";

const pixels = (...groups: Array<[number, [number, number, number]]>) => {
  const out: number[] = [];
  for (const [count, [r, g, b]] of groups) for (let i = 0; i < count; i++) out.push(r, g, b, 255);
  return out;
};
const hue = (c: [number, number, number]) => rgbToHsl(c)[0];

describe("share card colour follows the artwork", () => {
  it("uses the artwork's main colour (red artwork gives a red card)", () => {
    const p = paletteFromPixels(pixels([200, [210, 30, 30]], [56, [20, 20, 20]]));
    expect(p.fromArtwork).toBe(true);
    const h = hue(p.accent);
    expect(h < 15 || h > 345).toBe(true);
    expect(hue(p.bg) < 15 || hue(p.bg) > 345).toBe(true);
  });

  it("a blue-green artwork gives a teal card, not the default gold", () => {
    const p = paletteFromPixels(pixels([256, [20, 160, 170]]));
    expect(hue(p.accent)).toBeGreaterThan(170);
    expect(hue(p.accent)).toBeLessThan(200);
    expect(p.accent).not.toEqual(DEFAULT_PALETTE.accent);
  });

  it("picks the colourful subject over a black or white backdrop", () => {
    const c = dominantArtworkColor(pixels([180, [5, 5, 5]], [40, [250, 250, 250]], [36, [240, 140, 20]]));
    expect(c).not.toBeNull();
    const h = hue(c!);
    expect(h).toBeGreaterThan(20);
    expect(h).toBeLessThan(45);
  });

  it("falls back to navy and gold for black-and-white artwork or no artwork", () => {
    expect(paletteFromPixels(pixels([256, [128, 128, 128]]))).toEqual(DEFAULT_PALETTE);
    expect(paletteFromPixels([])).toEqual(DEFAULT_PALETTE);
  });

  it("keeps the label text readable on the card background for any colour", () => {
    for (const c of [[255, 255, 0], [0, 0, 255], [255, 0, 255], [0, 255, 0], [120, 60, 20]] as const) {
      const p = paletteFromPixels(pixels([256, [c[0], c[1], c[2]]]));
      expect(contrastRatio(p.accentLight, p.bgDeep)).toBeGreaterThanOrEqual(7);
    }
  });
});
