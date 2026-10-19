/**
 * Playback adapter for encrypted downloads.
 * Preferred: the service worker streams /offline-stream/<package> and decrypts
 * only the 1 MB chunks a byte range needs (seeking stays instant).
 * Fallback (preview, iOS, native wrappers): decrypt into memory for the current
 * track only; nothing decrypted is written to storage.
 */
import * as store from "./store";
import { unwrapContentKey, decryptChunk } from "./crypto";
import { isLicenceValid } from "./policy";
import type { SecureKind } from "./types";

const MEMORY_LIMIT = 3;
const memory = new Map<string, string>();
let streaming: boolean | null = null;

async function streamingAvailable(): Promise<boolean> {
  if (streaming) return true;
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || /^((?!chrome|android|crios|fxios).)*safari/i.test(ua)) return false;
  const ok = await new Promise<boolean>((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve(false), 600);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data?.type === "LMK_OFFLINE_STREAM_PONG"); };
    sw.postMessage({ type: "LMK_OFFLINE_STREAM_PING" }, [ch.port2]);
  });
  if (ok) streaming = true;
  return ok;
}

export async function hasSecure(songId: string, kind: SecureKind = "audio") {
  const item = await store.getItem(songId).catch(() => null);
  return !!item && item.status === "ready" && item.packages.some((p) => p.kind === kind);
}

export async function getSecurePlayableUrl(songId: string, kind: SecureKind): Promise<string | null> {
  const item = await store.getItem(songId).catch(() => null);
  if (!item || item.status !== "ready") return null;
  const pkg = item.packages.find((p) => p.kind === kind);
  if (!pkg?.licence || !isLicenceValid(pkg.licence.expiresAt)) return null;

  if (await streamingAvailable()) return `/offline-stream/${pkg.packageId}`;

  const cached = memory.get(pkg.packageId);
  if (cached) return cached;
  const device = await store.getDevice();
  if (!device) return null;
  const key = await unwrapContentKey(device.privateKey, pkg.packageId, pkg.licence);
  const parts: ArrayBuffer[] = [];
  for (let i = 0; i < pkg.chunkCount; i++) {
    const data = await store.getChunk(pkg.packageId, i);
    if (!data) return null;
    parts.push(await decryptChunk(key, pkg.packageId, i, data));
  }
  const url = URL.createObjectURL(new Blob(parts, { type: pkg.mimeType }));
  memory.set(pkg.packageId, url);
  while (memory.size > MEMORY_LIMIT) {
    const [oldest, oldUrl] = memory.entries().next().value as [string, string];
    memory.delete(oldest);
    setTimeout(() => URL.revokeObjectURL(oldUrl), 30000);
  }
  return url;
}

export function clearPlaybackMemory() {
  memory.forEach((u) => URL.revokeObjectURL(u));
  memory.clear();
}
