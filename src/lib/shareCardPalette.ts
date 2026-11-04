/**
 * Builds the share card colour theme from the artwork's pixels.
 * Pure (no DOM) so the rules can be unit-tested.
 */
export type RGB = [number, number, number];

export interface CardPalette {
  /** Main background tone (dark, keeps artwork hue). */
  bg: RGB;
  /** Deepest background tone, used at the bottom and behind the ♪ fallback. */
  bgDeep: RGB;
  /** Rich accent for glows and frames. */
  accent: RGB;
  /** Light accent for the wordmark, labels and "Scan to listen". */
  accentLight: RGB;
  /** Darker accent for gradient ends. */
  accentDark: RGB;
  /** True when the colours came from the artwork, false for the default navy/gold. */
  fromArtwork: boolean;
}

export const DEFAULT_PALETTE: CardPalette = {
  bg: [10, 21, 48],
  bgDeep: [5, 11, 28],
  accent: [212, 165, 52],
  accentLight: [243, 210, 122],
  accentDark: [138, 100, 24],
  fromArtwork: false,
};

export const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
export const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export const rgbToHsl = ([r, g, b]: RGB): [number, number, number] => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h *= 60;
  return [h, s, l];
};

export const hslToRgb = (h: number, s: number, l: number): RGB => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

const luminance = ([r, g, b]: RGB) => {
  const ch = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
export const contrastRatio = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const HUE_BINS = 18;

/** Picks the most prominent colourful hue in RGBA pixel data (e.g. from getImageData). */
export function dominantArtworkColor(data: ArrayLike<number>): RGB | null {
  const bins = Array.from({ length: HUE_BINS }, () => ({ score: 0, r: 0, g: 0, b: 0, n: 0 }));
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const px: RGB = [data[i], data[i + 1], data[i + 2]];
    const [h, s, l] = rgbToHsl(px);
    if (l < 0.08 || l > 0.94 || s < 0.18) continue; // skip black, white and greys
    const bin = bins[Math.floor(h / (360 / HUE_BINS)) % HUE_BINS];
    // Favour vivid, mid-light pixels so a small bright subject can beat a dull backdrop.
    const w = s * (1 - Math.abs(l - 0.5) * 1.2);
    bin.score += w; bin.r += px[0]; bin.g += px[1]; bin.b += px[2]; bin.n++;
  }
  const total = data.length / 4;
  const best = bins.reduce((a, b) => (b.score > a.score ? b : a));
  // Need a real presence (≥3% of pixels) — otherwise treat the artwork as monochrome.
  if (best.n === 0 || best.n < total * 0.03) return null;
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}

/** Derives a readable card theme from the artwork's dominant colour. */
export function paletteFromColor(color: RGB | null): CardPalette {
  if (!color) return DEFAULT_PALETTE;
  const [h, s0] = rgbToHsl(color);
  const s = Math.min(0.9, Math.max(0.45, s0));
  const bgS = Math.min(0.65, s);
  const palette: CardPalette = {
    bg: hslToRgb(h, bgS, 0.15),
    bgDeep: hslToRgb(h, bgS, 0.07),
    accent: hslToRgb(h, s, 0.58),
    accentLight: hslToRgb(h, Math.min(0.95, s + 0.1), 0.8),
    accentDark: hslToRgb(h, s, 0.34),
    fromArtwork: true,
  };
  // Light accent text must stay readable on the darkest background.
  let l = 0.8;
  while (contrastRatio(palette.accentLight, palette.bgDeep) < 7 && l < 0.95) {
    l += 0.03;
    palette.accentLight = hslToRgb(h, Math.min(0.95, s + 0.1), l);
  }
  return palette;
}

export const paletteFromPixels = (data: ArrayLike<number>) => paletteFromColor(dominantArtworkColor(data));
