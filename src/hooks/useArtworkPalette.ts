import { useEffect, useState } from "react";
import { DEFAULT_PALETTE, paletteFromPixels, type CardPalette } from "@/lib/shareCardPalette";

const cache = new Map<string, CardPalette>();

/** Reads a small copy of an image and returns its colour theme (navy/gold when unreadable). */
export function useArtworkPalette(url: string | null | undefined): CardPalette {
  const [palette, setPalette] = useState<CardPalette>(() => (url && cache.get(url)) || DEFAULT_PALETTE);
  useEffect(() => {
    if (!url) { setPalette(DEFAULT_PALETTE); return; }
    const hit = cache.get(url);
    if (hit) { setPalette(hit); return; }
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 48;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 48, 48);
        const p = paletteFromPixels(ctx.getImageData(0, 0, 48, 48).data);
        cache.set(url, p);
        if (alive) setPalette(p);
      } catch { /* image host blocks reading pixels: keep navy/gold */ }
    };
    img.src = url;
    return () => { alive = false; };
  }, [url]);
  return palette;
}
