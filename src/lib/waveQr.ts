/**
 * Soundwave-style QR layout: dark modules in each column are merged into
 * rounded vertical bars, like the wave in the Loveworld logo.
 * Pure (no DOM) so the layout rules can be unit-tested; drawing lives in drawWaveQr.
 */
export interface QrMatrix {
  size: number;
  get: (row: number, col: number) => boolean;
}

export interface WaveBar {
  col: number;
  /** First row of the bar. */
  row: number;
  /** Number of modules the bar covers. */
  length: number;
}

/** True for cells inside the three 7x7 corner finder patterns. */
export const isFinderCell = (n: number, row: number, col: number) =>
  (row < 7 && col < 7) || (row < 7 && col >= n - 7) || (row >= n - 7 && col < 7);

/** Cells cleared for the centre emblem: a circle whose radius is `ratio` of the code width. */
export const isBadgeCell = (n: number, row: number, col: number, ratio: number) => {
  if (ratio <= 0) return false;
  const c = (n - 1) / 2;
  const r = n * ratio;
  return (row - c) ** 2 + (col - c) ** 2 <= r * r;
};

/** Groups dark modules into vertical bars, skipping finder patterns and the emblem area. */
export function waveBars(m: QrMatrix, badgeRatio = 0.11): WaveBar[] {
  const n = m.size;
  const bars: WaveBar[] = [];
  for (let col = 0; col < n; col++) {
    let start = -1;
    for (let row = 0; row <= n; row++) {
      const on = row < n && m.get(row, col) && !isFinderCell(n, row, col) && !isBadgeCell(n, row, col, badgeRatio);
      if (on && start < 0) start = row;
      if (!on && start >= 0) {
        bars.push({ col, row: start, length: row - start });
        start = -1;
      }
    }
  }
  return bars;
}

export interface WaveQrColors {
  /** Bar colour (must be dark against the plate). */
  dark: string;
  /** Finder pattern colour (must be dark against the plate). */
  finder: string;
  /** Plate colour behind the code (must be light). */
  light: string;
}

const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

/**
 * Draws the code into a square (x, y, size), quiet zone included.
 * Returns the emblem circle so the caller can place the logo there.
 */
export async function drawWaveQr(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  colors: WaveQrColors,
  quiet = 3,
) {
  const QRCode = (await import("qrcode")).default;
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const matrix: QrMatrix = { size: n, get: (r, c) => !!qr.modules.get(r, c) };
  const mod = size / (n + quiet * 2);
  const ox = x + quiet * mod, oy = y + quiet * mod;

  ctx.save();
  ctx.fillStyle = colors.light;
  ctx.fillRect(x, y, size, size);

  // Soundwave bars
  const bw = mod * 0.8;
  const inset = mod * 0.07;
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  for (const b of waveBars(matrix)) {
    roundRectPath(ctx, ox + b.col * mod + (mod - bw) / 2, oy + b.row * mod + inset, bw, b.length * mod - inset * 2, bw / 2);
  }
  ctx.fill();

  // Finder eyes: soft rounded ring with a rounded core.
  ctx.fillStyle = colors.finder;
  for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
    const fx = ox + fc * mod, fy = oy + fr * mod;
    ctx.beginPath();
    roundRectPath(ctx, fx, fy, mod * 7, mod * 7, mod * 2.4);
    roundRectPath(ctx, fx + mod, fy + mod, mod * 5, mod * 5, mod * 1.6);
    ctx.fill("evenodd");
    ctx.beginPath();
    roundRectPath(ctx, fx + mod * 2, fy + mod * 2, mod * 3, mod * 3, mod * 1.1);
    ctx.fill();
  }
  ctx.restore();

  const c = (n - 1) / 2;
  return { cx: ox + (c + 0.5) * mod, cy: oy + (c + 0.5) * mod, r: n * 0.11 * mod };
}
