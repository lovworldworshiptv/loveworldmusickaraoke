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

/** Group songs so each licence request carries at most `max` packages (a song is never split). */
export function licenceBatches<T extends { packages: unknown[] }>(items: T[], max = 60): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let n = 0;
  for (const it of items) {
    const k = Math.max(1, it.packages.length);
    if (cur.length && n + k > max) { out.push(cur); cur = []; n = 0; }
    cur.push(it); n += k;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Chunks still to fetch — a resumed download continues from the first missing chunk. */
export const missingChunks = (have: Set<number>, count: number) =>
  Array.from({ length: count }, (_, i) => i).filter((i) => !have.has(i));

/**
 * Parse an HTTP Range header the same way the service worker does (public/serviceworker.js).
 * Returns null for an unsatisfiable range. `maxSpan` caps how much one response serves.
 */
export function parseRange(header: string, total: number, maxSpan = 2 * 1024 * 1024) {
  const m = /bytes=(\d*)-(\d*)/.exec(header) || [];
  let start: number; let end: number;
  if (m[1] === "" || m[1] === undefined) { start = Math.max(0, total - Number(m[2] || 0)); end = total - 1; }
  else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1; }
  if (start >= total || start > end) return null;
  end = Math.min(end, start + maxSpan - 1);
  return { start, end };
}

/** Fetch a chunk, check it, and fetch it again when it is damaged or incomplete. */
export async function fetchVerified(
  get: () => Promise<ArrayBuffer>,
  verify: (data: ArrayBuffer) => Promise<unknown>,
  opts: { retries: number; wait: (attempt: number) => Promise<void>; onError?: (e: unknown) => unknown },
): Promise<ArrayBuffer> {
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await get();
      await verify(data);
      return data;
    } catch (e) {
      const stop = opts.onError?.(e);
      if (stop) throw stop;
      if (attempt >= opts.retries) throw e;
      await opts.wait(attempt);
    }
  }
}

export interface LocalEntry { songId: string; addedAt: number; source: string }
/**
 * Compare the account library with this device.
 * - remove: removed on another device after it was saved here (or gone for over 2 minutes)
 * - queue: on the account but not on this device (offered for restore)
 */
export function reconcile(
  cloudIds: string[], local: LocalEntry[], removedAt: Map<string, number>, now: number, alsoOnDevice: string[] = [],
) {
  const inCloud = new Set(cloudIds);
  const remove: string[] = [];
  const keep: string[] = [];
  for (const i of local) {
    if (i.source === "legacy" || inCloud.has(i.songId)) { keep.push(i.songId); continue; }
    const at = removedAt.get(i.songId);
    if ((at !== undefined && at > i.addedAt) || (at === undefined && now - i.addedAt > 120000)) remove.push(i.songId);
    else keep.push(i.songId);
  }
  const onDevice = new Set([...keep, ...alsoOnDevice]);
  return { remove, keep, queue: cloudIds.filter((id) => !onDevice.has(id)) };
}
