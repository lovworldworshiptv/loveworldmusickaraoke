import QRCode from "qrcode";
import { CARD_SIZES, KIND_LABELS, truncateTitle, wrapLines, type ShareCardFormat, type ShareCardItem } from "@/lib/shareCard";
import { DEFAULT_PALETTE, paletteFromPixels, rgb, rgba, type CardPalette } from "@/lib/shareCardPalette";

const CREAM = "#fffdf6";

/** Samples the cover on a small canvas and builds the card colours from it. */
const artworkPalette = (img: HTMLImageElement | null): CardPalette => {
  if (!img) return DEFAULT_PALETTE;
  try {
    const n = 48;
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, n, n);
    return paletteFromPixels(x.getImageData(0, 0, n, n).data);
  } catch {
    return DEFAULT_PALETTE;
  }
};

const loadImage = (src: string, cors: boolean) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Returns the cover only if it can be drawn without tainting the canvas. */
const safeCover = async (url?: string | null) => {
  if (!url) return null;
  try {
    const img = await loadImage(url, true);
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0, 2, 2);
    x.getImageData(0, 0, 1, 1);
    return img;
  } catch {
    return null;
  }
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawCoverFit = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
};

const accentGradient = (ctx: CanvasRenderingContext2D, p: CardPalette, x: number, y: number, w: number, h: number) => {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, rgb(p.accentDark));
  g.addColorStop(0.5, rgb(p.accentLight));
  g.addColorStop(1, rgb(p.accent));
  return g;
};

export async function renderShareCard(item: ShareCardItem, format: ShareCardFormat, link: string, logoUrl: string): Promise<HTMLCanvasElement> {
  const { w: W, h: H } = CARD_SIZES[format];
  const portrait = format === "portrait";
  await Promise.all([
    document.fonts.load("700 64px 'Playfair Display'").catch(() => {}),
    document.fonts.load("500 32px Inter").catch(() => {}),
  ]);
  await document.fonts.ready;
  const [cover, logo] = await Promise.all([safeCover(item.coverUrl), loadImage(logoUrl, false).catch(() => null)]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const pal = artworkPalette(cover);

  // Background: artwork-coloured base with the blurred, darkened cover on top.
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, rgb(pal.bg));
  base.addColorStop(1, rgb(pal.bgDeep));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  if (cover) {
    ctx.save();
    ctx.filter = "blur(60px) brightness(0.45) saturate(1.2)";
    drawCoverFit(ctx, cover, -100, -100, W + 200, H + 200);
    ctx.restore();
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, rgba(pal.bgDeep, 0.3));
  shade.addColorStop(1, rgba(pal.bgDeep, 0.92));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  // Accent light beams
  for (const [cx, cy, r, a] of [[W * 0.15, 0, W * 0.9, 0.22], [W * 0.95, H * 0.35, W * 0.6, 0.12]] as const) {
    const beam = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    beam.addColorStop(0, rgba(pal.accentLight, a));
    beam.addColorStop(1, rgba(pal.accentLight, 0));
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, W, H);
  }

  const pad = 72;
  // Header: logo + wordmark
  const logoSize = 72;
  if (logo) {
    ctx.save();
    roundRect(ctx, pad, pad, logoSize, logoSize, 18);
    ctx.clip();
    ctx.drawImage(logo, pad, pad, logoSize, logoSize);
    ctx.restore();
  }
  ctx.fillStyle = rgb(pal.accentLight);
  ctx.font = "700 40px 'Playfair Display', serif";
  ctx.textBaseline = "middle";
  ctx.fillText("Loveworld Music+", pad + logoSize + 22, pad + logoSize / 2);

  // Cover art
  const coverSize = portrait ? 560 : 420;
  const coverX = portrait ? (W - coverSize) / 2 : pad;
  const coverY = portrait ? 200 : 210;
  ctx.save();
  ctx.shadowColor = rgba(pal.accent, 0.55);
  ctx.shadowBlur = 70;
  roundRect(ctx, coverX, coverY, coverSize, coverSize, 36);
  ctx.fillStyle = accentGradient(ctx, pal, coverX, coverY, coverSize, coverSize);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, coverX, coverY, coverSize, coverSize, 36);
  ctx.clip();
  if (cover) drawCoverFit(ctx, cover, coverX, coverY, coverSize, coverSize);
  else {
    ctx.fillStyle = rgb(pal.bgDeep);
    ctx.font = `700 ${coverSize * 0.32}px 'Playfair Display', serif`;
    ctx.textAlign = "center";
    ctx.fillText("♪", coverX + coverSize / 2, coverY + coverSize / 2);
    ctx.textAlign = "left";
  }
  ctx.restore();

  // Text block
  const textX = portrait ? pad : coverX + coverSize + 56;
  const textW = portrait ? W - pad * 2 - 300 : W - textX - pad;
  let ty = portrait ? coverY + coverSize + 70 : coverY + 20;
  ctx.textBaseline = "top";
  ctx.fillStyle = rgb(pal.accentLight);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillText(KIND_LABELS[item.kind], textX, ty);
  ty += 48;
  ctx.fillStyle = CREAM;
  const titleSize = portrait ? 58 : 54;
  ctx.font = `700 ${titleSize}px 'Playfair Display', serif`;
  const lines = wrapLines(truncateTitle(item.title), textW, (s) => ctx.measureText(s).width, 2);
  for (const l of lines) { ctx.fillText(l, textX, ty); ty += titleSize * 1.18; }
  if (item.subtitle) {
    ty += 10;
    ctx.fillStyle = "rgba(255,253,246,0.75)";
    ctx.font = "500 32px Inter, sans-serif";
    ctx.fillText(wrapLines(item.subtitle, textW, (s) => ctx.measureText(s).width, 1)[0], textX, ty);
  }

  // QR tile: dark modules on cream, level H, 4-module quiet zone.
  const qrSize = portrait ? 260 : 300;
  const tile = qrSize + 40;
  const tileX = W - pad - tile;
  const tileY = portrait ? coverY + coverSize + 56 : H - pad - tile - 60;
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, link, { errorCorrectionLevel: "H", margin: 4, width: qrSize * 2, color: { dark: "#000000", light: "#ffffff" } });
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 30;
  roundRect(ctx, tileX, tileY, tile, tile, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, tileX + 20, tileY + 20, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;
  if (logo) {
    const b = qrSize * 0.18;
    const bx = tileX + 20 + (qrSize - b) / 2, by = tileY + 20 + (qrSize - b) / 2;
    roundRect(ctx, bx - 6, by - 6, b + 12, b + 12, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    roundRect(ctx, bx, by, b, b, 8);
    ctx.clip();
    ctx.drawImage(logo, bx, by, b, b);
    ctx.restore();
  }
  ctx.fillStyle = rgb(pal.accentLight);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Scan to listen", tileX + tile / 2, tileY + tile + 18);
  ctx.textAlign = "left";

  // Footer
  ctx.fillStyle = "rgba(255,253,246,0.7)";
  ctx.font = "500 28px Inter, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("loveworldmusickaraoke.com", pad, H - pad + 6);

  return canvas;
}
