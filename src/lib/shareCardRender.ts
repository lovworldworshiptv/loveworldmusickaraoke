import { CARD_SIZES, KIND_LABELS, truncateTitle, wrapLines, type ShareCardFormat, type ShareCardItem, type ShareCardStyle } from "@/lib/shareCard";
import { DEFAULT_PALETTE, paletteFromPixels, rgb, rgba, type CardPalette } from "@/lib/shareCardPalette";
import { drawWaveQr } from "@/lib/waveQr";

const CREAM = "#fffdf6";
const PEARL = "#fbf8ef";

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

/** Arch: semicircular top, softly rounded bottom corners. */
const archPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rb: number) => {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h - rb);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h - rb);
  ctx.arcTo(x + w, y + h, x + w - rb, y + h, rb);
  ctx.lineTo(x + rb, y + h);
  ctx.arcTo(x, y + h, x, y + h - rb, rb);
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

/** Cover (or ♪ fallback) clipped to the current path. */
const fillCover = (ctx: CanvasRenderingContext2D, cover: HTMLImageElement | null, pal: CardPalette, x: number, y: number, w: number, h: number) => {
  ctx.save();
  ctx.clip();
  if (cover) drawCoverFit(ctx, cover, x, y, w, h);
  else {
    ctx.fillStyle = rgb(pal.bgDeep);
    ctx.font = `700 ${Math.min(w, h) * 0.32}px 'Playfair Display', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", x + w / 2, y + h / 2);
  }
  ctx.restore();
};

/** Row of rounded soundwave bars, echoing the logo's wave. */
const drawSoundwave = (ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number, color: string, count = 23) => {
  const step = width / count;
  const bw = step * 0.42;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const env = Math.sin(t * Math.PI);
    const h = Math.max(bw, height * env * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7))));
    roundRect(ctx, cx - width / 2 + i * step + (step - bw) / 2, cy - h / 2, bw, h, bw / 2);
    ctx.fill();
  }
};

/** Wave QR on a light plate with the logo in the centre; returns nothing. */
const drawQrPlate = async (
  ctx: CanvasRenderingContext2D, link: string, logo: HTMLImageElement | null, pal: CardPalette,
  x: number, y: number, size: number, plate: string, radius: number,
) => {
  roundRect(ctx, x, y, size, size, radius);
  ctx.fillStyle = plate;
  ctx.fill();
  const inner = size - radius * 0.6;
  const off = (size - inner) / 2;
  const badge = await drawWaveQr(ctx, link, x + off, y + off, inner, {
    dark: rgb(pal.bgDeep),
    finder: rgb(pal.bgDeep),
    light: plate,
  });
  if (logo) {
    const s = badge.r * 1.5;
    ctx.save();
    roundRect(ctx, badge.cx - s / 2, badge.cy - s / 2, s, s, s * 0.26);
    ctx.clip();
    ctx.drawImage(logo, badge.cx - s / 2, badge.cy - s / 2, s, s);
    ctx.restore();
  }
};

const drawLogo = (ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, y: number, size: number) => {
  if (!logo) return;
  ctx.save();
  roundRect(ctx, x, y, size, size, size * 0.25);
  ctx.clip();
  ctx.drawImage(logo, x, y, size, size);
  ctx.restore();
};

interface Ctx {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  portrait: boolean;
  item: ShareCardItem;
  link: string;
  cover: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  pal: CardPalette;
}

/** Royal Glass Wave: blurred artwork, gold wave ribbons, frosted glass QR pod. */
async function drawGlass({ ctx, W, H, portrait, item, link, cover, logo, pal }: Ctx) {
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
  for (const [cx, cy, r, a] of [[W * 0.15, 0, W * 0.9, 0.22], [W * 0.95, H * 0.35, W * 0.6, 0.12]] as const) {
    const beam = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    beam.addColorStop(0, rgba(pal.accentLight, a));
    beam.addColorStop(1, rgba(pal.accentLight, 0));
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, W, H);
  }

  const pad = 72;
  const coverSize = portrait ? 560 : 420;
  const coverX = portrait ? (W - coverSize) / 2 : pad;
  const coverY = portrait ? 200 : 210;

  // Flowing gold wave ribbons across the lower half.
  const waveY = portrait ? H - 120 : H - 190;
  ctx.save();
  ctx.lineCap = "round";
  [[0, 0.32, 3], [18, 0.2, 2], [36, 0.12, 2]].forEach(([shift, alpha, lw], i) => {
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 8) {
      const y = waveY + shift + Math.sin(x / 150 + i * 0.8) * 34 + Math.sin(x / 61 + i) * 9;
      x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(pal.accentLight, alpha);
    ctx.lineWidth = lw;
    ctx.stroke();
  });
  ctx.restore();

  // Header
  const logoSize = 72;
  drawLogo(ctx, logo, pad, pad, logoSize);
  ctx.fillStyle = rgb(pal.accentLight);
  ctx.font = "700 40px 'Playfair Display', serif";
  ctx.textBaseline = "middle";
  ctx.fillText("Loveworld Music+", pad + logoSize + 22, pad + logoSize / 2);

  // Cover
  ctx.save();
  ctx.shadowColor = rgba(pal.accent, 0.55);
  ctx.shadowBlur = 70;
  roundRect(ctx, coverX, coverY, coverSize, coverSize, 36);
  ctx.fillStyle = accentGradient(ctx, pal, coverX, coverY, coverSize, coverSize);
  ctx.fill();
  ctx.restore();
  roundRect(ctx, coverX, coverY, coverSize, coverSize, 36);
  fillCover(ctx, cover, pal, coverX, coverY, coverSize, coverSize);

  // Text
  const textX = portrait ? pad : coverX + coverSize + 56;
  const textW = portrait ? W - pad * 2 - 340 : W - textX - pad;
  let ty = portrait ? coverY + coverSize + 70 : coverY + 20;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = rgb(pal.accentLight);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillText(KIND_LABELS[item.kind], textX, ty);
  ty += 48;
  ctx.fillStyle = CREAM;
  const titleSize = portrait ? 58 : 54;
  ctx.font = `700 ${titleSize}px 'Playfair Display', serif`;
  for (const l of wrapLines(truncateTitle(item.title), textW, (s) => ctx.measureText(s).width, 2)) {
    ctx.fillText(l, textX, ty);
    ty += titleSize * 1.18;
  }
  if (item.subtitle) {
    ty += 10;
    ctx.fillStyle = "rgba(255,253,246,0.75)";
    ctx.font = "500 32px Inter, sans-serif";
    ctx.fillText(wrapLines(item.subtitle, textW, (s) => ctx.measureText(s).width, 1)[0], textX, ty);
  }

  // Frosted glass QR pod
  const pod = portrait ? 320 : 340;
  const podX = W - pad - pod;
  const podY = portrait ? coverY + coverSize + 44 : H - pad - pod - 40;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 40;
  roundRect(ctx, podX, podY, pod, pod, 40);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, podX, podY, pod, pod, 40);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = accentGradient(ctx, pal, podX, podY, pod, pod);
  ctx.stroke();
  const plateInset = 22;
  await drawQrPlate(ctx, link, logo, pal, podX + plateInset, podY + plateInset, pod - plateInset * 2, "#ffffff", 26);

  ctx.fillStyle = rgb(pal.accentLight);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Scan to listen", podX + pod / 2, podY + pod + 16);
  ctx.textAlign = "left";
}

/** Symphony Arch: calm editorial poster with an arched cover and pearl QR plate. */
async function drawArch({ ctx, W, H, portrait, item, link, cover, logo, pal }: Ctx) {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, rgb(pal.bg));
  base.addColorStop(1, rgb(pal.bgDeep));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const coverW = portrait ? 420 : 440;
  const coverH = portrait ? 540 : 680;
  const coverX = portrait ? (W - coverW) / 2 : 104;
  const coverY = portrait ? 156 : 196;
  const ccx = coverX + coverW / 2;

  const glow = ctx.createRadialGradient(ccx, coverY + coverH * 0.4, 0, ccx, coverY + coverH * 0.4, coverW * 1.2);
  glow.addColorStop(0, rgba(pal.accent, 0.28));
  glow.addColorStop(1, rgba(pal.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Hairline frame
  roundRect(ctx, 32, 32, W - 64, H - 64, 30);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(pal.accentLight, 0.35);
  ctx.stroke();

  // Concentric arches echoing the cover
  ctx.save();
  roundRect(ctx, 33, 33, W - 66, H - 66, 30);
  ctx.clip();
  [[30, 0.3], [62, 0.18], [96, 0.09]].forEach(([o, a]) => {
    archPath(ctx, coverX - o, coverY - o, coverW + o * 2, coverH + o * 2, 28 + o);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(pal.accentLight, a);
    ctx.stroke();
  });
  ctx.restore();

  // Header: centred wordmark
  const logoSize = 56;
  ctx.font = "700 36px 'Playfair Display', serif";
  const wordW = ctx.measureText("Loveworld Music+").width;
  const groupW = (logo ? logoSize + 18 : 0) + wordW;
  const hx = (portrait ? W / 2 : W / 2) - groupW / 2;
  const hy = 74;
  drawLogo(ctx, logo, hx, hy, logoSize);
  ctx.fillStyle = rgb(pal.accentLight);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Loveworld Music+", hx + (logo ? logoSize + 18 : 0), hy + logoSize / 2);

  // Arched niche holding the whole (uncropped) square cover, soundwave in the dome.
  ctx.save();
  ctx.shadowColor = rgba(pal.bgDeep, 0.7);
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  archPath(ctx, coverX, coverY, coverW, coverH, 28);
  const niche = ctx.createLinearGradient(0, coverY, 0, coverY + coverH);
  niche.addColorStop(0, rgba(pal.accent, 0.55));
  niche.addColorStop(0.45, rgba(pal.bg, 0.95));
  niche.addColorStop(1, rgb(pal.bgDeep));
  ctx.fillStyle = niche;
  ctx.fill();
  ctx.restore();
  archPath(ctx, coverX, coverY, coverW, coverH, 28);
  ctx.lineWidth = 2;
  ctx.strokeStyle = accentGradient(ctx, pal, coverX, coverY, coverW, coverH);
  ctx.stroke();
  const inset = 22;
  const cs = coverW - inset * 2;
  const cy0 = coverY + coverH - inset - cs;
  drawSoundwave(ctx, ccx, coverY + (cy0 - coverY) / 2 + 10, coverW * 0.46, (cy0 - coverY) * 0.42, rgba(pal.accentLight, 0.85), 15);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 24;
  roundRect(ctx, coverX + inset, cy0, cs, cs, 18);
  ctx.fillStyle = rgb(pal.bgDeep);
  ctx.fill();
  ctx.restore();
  roundRect(ctx, coverX + inset, cy0, cs, cs, 18);
  fillCover(ctx, cover, pal, coverX + inset, cy0, cs, cs);

  // Text column
  const colX = portrait ? W / 2 : coverX + coverW + (W - 104 - coverX - coverW) / 2;
  const textW = portrait ? W - 220 : W - 104 - (coverX + coverW) - 60;
  let ty = portrait ? coverY + coverH + 44 : coverY + 6;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = rgb(pal.accentLight);
  ctx.font = "italic 500 28px 'Playfair Display', serif";
  ctx.fillText(KIND_LABELS[item.kind], colX, ty);
  ty += 46;
  ctx.fillStyle = CREAM;
  const titleSize = portrait ? 52 : 50;
  ctx.font = `700 ${titleSize}px 'Playfair Display', serif`;
  for (const l of wrapLines(truncateTitle(item.title), textW, (s) => ctx.measureText(s).width, 2)) {
    ctx.fillText(l, colX, ty);
    ty += titleSize * 1.16;
  }
  if (item.subtitle) {
    ty += 8;
    ctx.fillStyle = "rgba(255,253,246,0.75)";
    ctx.font = "500 30px Inter, sans-serif";
    ctx.fillText(wrapLines(item.subtitle, textW, (s) => ctx.measureText(s).width, 1)[0], colX, ty);
  }

  // Pearl QR plate, anchored to the bottom of the text column
  const plate = portrait ? 270 : 300;
  const px = colX - plate / 2;
  const py = H - 76 - 40 - plate;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 36;
  roundRect(ctx, px, py, plate, plate, 30);
  ctx.fillStyle = PEARL;
  ctx.fill();
  ctx.restore();
  await drawQrPlate(ctx, link, logo, pal, px, py, plate, PEARL, 30);
  roundRect(ctx, px - 8, py - 8, plate + 16, plate + 16, 36);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(pal.accentLight, 0.55);
  ctx.stroke();

  ctx.fillStyle = rgb(pal.accentLight);
  ctx.font = "italic 500 30px 'Playfair Display', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Scan to listen", colX, py + plate + 20);

  ctx.textAlign = "left";
}

export async function renderShareCard(
  item: ShareCardItem,
  format: ShareCardFormat,
  style: ShareCardStyle,
  link: string,
  logoUrl: string,
): Promise<HTMLCanvasElement> {
  const { w: W, h: H } = CARD_SIZES[format];
  await Promise.all([
    document.fonts.load("700 64px 'Playfair Display'").catch(() => {}),
    document.fonts.load("italic 500 30px 'Playfair Display'").catch(() => {}),
    document.fonts.load("500 32px Inter").catch(() => {}),
  ]);
  await document.fonts.ready;
  const [cover, logo] = await Promise.all([safeCover(item.coverUrl), loadImage(logoUrl, false).catch(() => null)]);

  const pal = artworkPalette(cover);
  const drawCard = async (w: number, h: number, portrait: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const c: Ctx = { ctx: canvas.getContext("2d")!, W: w, H: h, portrait, item, link, cover, logo, pal };
    if (style === "arch") await drawArch(c);
    else await drawGlass(c);
    return canvas;
  };
  if (format !== "story") return drawCard(W, H, format === "portrait");

  // Story: the portrait card floats on an artwork-coloured backdrop, clear of the
  // top and bottom areas that status/story apps cover with their own buttons.
  const { w: cw, h: ch } = CARD_SIZES.portrait;
  const card = await drawCard(cw, ch, true);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, rgb(pal.accentDark));
  base.addColorStop(0.5, rgb(pal.bg));
  base.addColorStop(1, rgb(pal.bgDeep));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  if (cover) {
    ctx.save();
    ctx.filter = "blur(80px) brightness(0.6) saturate(1.3)";
    drawCoverFit(ctx, cover, -160, -160, W + 320, H + 320);
    ctx.restore();
    ctx.fillStyle = rgba(pal.bgDeep, 0.35);
    ctx.fillRect(0, 0, W, H);
  }
  const scale = 0.86;
  const dw = cw * scale, dh = ch * scale;
  const dx = (W - dw) / 2, dy = (H - dh) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 24;
  roundRect(ctx, dx, dy, dw, dh, 44);
  ctx.fillStyle = rgb(pal.bgDeep);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, dx, dy, dw, dh, 44);
  ctx.clip();
  ctx.drawImage(card, dx, dy, dw, dh);
  ctx.restore();
  return canvas;
}
