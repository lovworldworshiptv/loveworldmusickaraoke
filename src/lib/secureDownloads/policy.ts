/** Pure rules for secure offline downloads (kept side-effect free for tests). */
import type { SecureItem } from "./types";

export const DAY_MS = 86400000;
/** Renew silently once a licence is within this window of expiring. */
export const RENEW_WINDOW_MS = 7 * DAY_MS;
/** Keep this much free space beyond the download itself. */
export const SPACE_HEADROOM_BYTES = 50 * 1024 * 1024;
/** Rough size when the exact package size is not known yet (≈128 kbps). */
export const ESTIMATED_BYTES_PER_SECOND = 16000;

export const needsRenewal = (expiresAt: string | undefined, now = Date.now()) =>
  !expiresAt || new Date(expiresAt).getTime() - now < RENEW_WINDOW_MS;

export const isLicenceValid = (expiresAt: string | undefined, now = Date.now()) =>
  !!expiresAt && new Date(expiresAt).getTime() > now;

/** Next item first: lowest priority number, then most recently added (newest history first). */
export function sortQueue<T extends Pick<SecureItem, "priority" | "addedAt">>(items: T[]): T[] {
  return [...items].sort((a, b) => a.priority - b.priority || b.addedAt - a.addedAt);
}

type Conn = { type?: string; saveData?: boolean; effectiveType?: string } | undefined | null;
/** True only when the connection is known to be mobile data or the listener asked to save data. */
export const isMeteredConnection = (c: Conn) => !!c && (c.saveData === true || c.type === "cellular");
export const isKnownUnmetered = (c: Conn) => !!c && !c.saveData && (c.type === "wifi" || c.type === "ethernet");

export const hasRoomFor = (est: { quota?: number; usage?: number } | null, bytes: number) => {
  if (!est || !est.quota) return true; // browser cannot tell us — don't block
  return est.quota - (est.usage ?? 0) >= bytes + SPACE_HEADROOM_BYTES;
};

/** Plain-text bytes in chunk `index` of a package. */
export const plainChunkLength = (index: number, chunkSize: number, chunkCount: number, byteLength: number) =>
  index < chunkCount - 1 ? chunkSize : byteLength - chunkSize * (chunkCount - 1);

/** Chunk indices and in-chunk offsets needed to serve a byte range. */
export function rangeToChunks(start: number, end: number, chunkSize: number) {
  return { first: Math.floor(start / chunkSize), last: Math.floor(end / chunkSize), offset: start % chunkSize };
}

export const estimateSongBytes = (durationSeconds: number, withInstrumental: boolean) =>
  Math.max(1, durationSeconds || 240) * ESTIMATED_BYTES_PER_SECOND * (withInstrumental ? 2 : 1);

export const formatBytes = (n: number) => {
  if (!n) return "0 MB";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
};
