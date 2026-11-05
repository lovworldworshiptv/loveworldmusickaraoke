/**
 * Keeps finished share-card images on the device so asking for the same card again
 * reuses the saved picture instead of drawing it from scratch.
 * Bump CARD_CACHE_VERSION whenever the card design changes so old pictures are replaced.
 */
export const CARD_CACHE_VERSION = "v1";
const CACHE_NAME = "lwm-share-cards";
const memory = new Map<string, Blob>();

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export interface CardKeyInput {
  kind: string; id: string; style: string; format: string;
  title: string; subtitle?: string | null; coverUrl?: string | null; link: string;
}

/** Same song + style + shape + details → same key; any change to the details gives a new key. */
export function cardCacheKey(i: CardKeyInput): string {
  const sig = hash([i.title, i.subtitle ?? "", i.coverUrl ?? "", i.link].join("|"));
  return `https://share-card.local/${CARD_CACHE_VERSION}/${i.kind}/${encodeURIComponent(i.id)}/${i.style}/${i.format}/${sig}.png`;
}

export async function getCachedCard(key: string): Promise<Blob | null> {
  const m = memory.get(key);
  if (m) return m;
  try {
    if (typeof caches === "undefined") return null;
    const res = await (await caches.open(CACHE_NAME)).match(key);
    if (!res) return null;
    const b = await res.blob();
    memory.set(key, b);
    return b;
  } catch { return null; }
}

export async function putCachedCard(key: string, blob: Blob): Promise<void> {
  memory.set(key, blob);
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, new Response(blob, { headers: { "Content-Type": "image/png" } }));
    // Drop pictures made by an older card design.
    for (const req of await cache.keys()) {
      if (!req.url.includes(`/${CARD_CACHE_VERSION}/`)) cache.delete(req);
    }
  } catch { /* storage full or blocked: memory copy still works this session */ }
}
