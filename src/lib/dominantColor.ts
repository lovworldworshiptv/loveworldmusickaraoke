import { useEffect, useState } from "react";

/**
 * Extracts the dominant color from an image URL using a tiny canvas sample.
 * Returns an [r, g, b] tuple or null while loading / on failure (e.g. CORS).
 */
export function useDominantColor(imageUrl: string | null | undefined): [number, number, number] | null {
  const [color, setColor] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    if (!imageUrl) { setColor(null); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 16;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          // Skip near-black and near-white pixels so the tint stays rich
          const lum = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
          if (lum < 20 || lum > 235) continue;
          r += pr; g += pg; b += pb; count++;
        }
        if (count === 0) { setColor(null); return; }
        setColor([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
      } catch {
        setColor(null);
      }
    };
    img.onerror = () => { if (!cancelled) setColor(null); };
    return () => { cancelled = true; };
  }, [imageUrl]);

  return color;
}

/** Spotify-style tone: keeps the artwork hue but darkens it so white text stays readable. */
export function playerTone(c: [number, number, number] | null, maxLum = 110): string | null {
  if (!c) return null;
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const k = lum > maxLum ? maxLum / lum : 1;
  return c.map((v) => Math.round(v * k)).join(", ");
}
