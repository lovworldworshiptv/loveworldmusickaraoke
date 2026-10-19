/**
 * Playback adapter for saved songs. Routes (see policy.choosePlaybackRoute):
 * 1. "stream" — the offline helper (service worker) serves /offline-stream/<package> and
 *    decrypts only the 1 MB chunks a byte range needs (seeking is instant).
 * 2. "mse" — where the helper can't run (preview, app wrappers, iPhone), audio is fed to the
 *    player chunk by chunk through Media Source Extensions: only ~a minute ahead and half a
 *    minute behind the playhead is decrypted at any time, and nothing has a downloadable URL.
 * 3. "memory" — only when neither exists (no helper and no media streaming, e.g. older iPhone
 *    app wrappers, or video without the helper): the current track is decrypted in memory.
 *    Nothing decrypted is ever written to storage.
 */
import * as store from "./store";
import { unwrapContentKey, decryptChunk } from "./crypto";
import { isLicenceValid, chunkForTime, chunkStartTime, choosePlaybackRoute, type PlaybackRoute } from "./policy";
import type { SecureItem, SecureKind, SecurePackage } from "./types";

const AHEAD_SECONDS = 60;
const BEHIND_SECONDS = 30;
const MSE_URL_LIMIT = 4;
const MEMORY_LIMIT = 1;

const memory = new Map<string, string>();
const mseUrls = new Map<string, string>();
let streaming: boolean | null = null;
let lastRoute: PlaybackRoute | null = null;

const isApple = () => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
};
const MediaSourceCtor = (): typeof MediaSource | null =>
  (globalThis as any).ManagedMediaSource || (globalThis as any).MediaSource || null;
const mseMime = (mime: string) => (/mp3|mpeg/i.test(mime) ? "audio/mpeg" : mime);
const mseSupports = (mime: string) => {
  const MS = MediaSourceCtor();
  try { return !!MS && MS.isTypeSupported(mseMime(mime)); } catch { return false; }
};

async function streamingAvailable(): Promise<boolean> {
  if (streaming) return true;
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return false;
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

/** Diagnostics: the route the last playback used on this device. */
export const lastPlaybackRoute = () => lastRoute;
export async function plannedRoute(kind: SecureKind = "audio", mime = "audio/mpeg"): Promise<PlaybackRoute> {
  return choosePlaybackRoute({ helper: await streamingAvailable(), apple: isApple(), mse: mseSupports(mime), kind });
}

export async function getSecurePlayableUrl(songId: string, kind: SecureKind): Promise<string | null> {
  const item = await store.getItem(songId).catch(() => null);
  if (!item || item.status !== "ready") return null;
  const pkg = item.packages.find((p) => p.kind === kind);
  if (!pkg?.licence || !isLicenceValid(pkg.licence.expiresAt)) return null;

  const route = await plannedRoute(kind, pkg.mimeType);
  lastRoute = route;
  if (route === "stream") return `/offline-stream/${pkg.packageId}`;
  if (route === "mse") return mseUrlFor(item, pkg);
  return memoryUrlFor(pkg);
}

// ---------------- route 2: chunk-by-chunk media streaming ----------------
function findElement(url: string): HTMLMediaElement | null {
  const audios: Set<HTMLMediaElement> | undefined = (globalThis as any).__lwPlayerAudios;
  for (const el of audios ?? []) if (el.src === url) return el;
  for (const el of Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video"))) if (el.src === url) return el;
  return null;
}

function mseUrlFor(item: SecureItem, pkg: SecurePackage): string {
  const cached = mseUrls.get(pkg.packageId);
  if (cached) return cached;
  const MS = MediaSourceCtor()!;
  const ms = new MS();
  const url = URL.createObjectURL(ms);
  // A MediaSource can be re-attached after the player lets go of it (reload, karaoke switch),
  // so every attachment starts a fresh session from the current position.
  ms.addEventListener("sourceopen", () => { runSession(ms, url, item, pkg).catch((e) => console.warn("Offline stream stopped:", e?.name || e)); });
  mseUrls.set(pkg.packageId, url);
  while (mseUrls.size > MSE_URL_LIMIT) {
    const [oldest, oldUrl] = mseUrls.entries().next().value as [string, string];
    mseUrls.delete(oldest);
    URL.revokeObjectURL(oldUrl);
  }
  return url;
}

const waitUpdate = (sb: SourceBuffer) => new Promise<void>((resolve, reject) => {
  if (!sb.updating) { resolve(); return; }
  const ok = () => { cleanup(); resolve(); };
  const bad = () => { cleanup(); reject(new Error("append failed")); };
  const cleanup = () => { sb.removeEventListener("updateend", ok); sb.removeEventListener("error", bad); };
  sb.addEventListener("updateend", ok);
  sb.addEventListener("error", bad);
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runSession(ms: MediaSource, url: string, item: SecureItem, pkg: SecurePackage) {
  const device = await store.getDevice();
  if (!device || !pkg.licence) { try { ms.endOfStream("decode"); } catch { /* closed */ } return; }
  const key = await unwrapContentKey(device.privateKey, pkg.packageId, pkg.licence);
  if (ms.readyState !== "open") return;
  const sb = ms.addSourceBuffer(mseMime(pkg.mimeType));
  const duration = item.meta.durationSeconds || 0;
  if (duration) { try { ms.duration = duration; } catch { /* not allowed yet */ } }

  let open = true;
  ms.addEventListener("sourceclose", () => { open = false; }, { once: true });
  let next = 0;
  let jumpTo: number | null = null;
  let el: HTMLMediaElement | null = null;
  const bufferedAt = (t: number) => {
    for (let i = 0; i < sb.buffered.length; i++) if (t >= sb.buffered.start(i) - 0.25 && t <= sb.buffered.end(i)) return true;
    return false;
  };
  const onSeeking = () => { if (el && !bufferedAt(el.currentTime)) jumpTo = el.currentTime; };

  try {
    while (open) {
      if (!el) {
        el = findElement(url);
        if (el) { el.addEventListener("seeking", onSeeking); if (el.currentTime > 1) jumpTo = el.currentTime; }
      }
      const now = el?.currentTime ?? 0;

      if (jumpTo !== null) {
        const target = jumpTo; jumpTo = null;
        await waitUpdate(sb);
        if (!open) break;
        if (sb.buffered.length) { sb.remove(0, Infinity); await waitUpdate(sb); }
        next = chunkForTime(target, duration, pkg.byteLength, pkg.chunkSize, pkg.chunkCount);
        sb.timestampOffset = chunkStartTime(next, duration, pkg.byteLength, pkg.chunkSize);
        continue;
      }

      const end = sb.buffered.length ? sb.buffered.end(sb.buffered.length - 1) : 0;
      if (next >= pkg.chunkCount || end - now > AHEAD_SECONDS) {
        if (next >= pkg.chunkCount && ms.readyState === "open" && !sb.updating) { try { ms.endOfStream(); } catch { /* already ended */ } }
        await sleep(400);
        continue;
      }

      const data = await store.getChunk(pkg, next);
      if (!data) { try { ms.endOfStream("decode"); } catch { /* closed */ } break; }
      const plain = await decryptChunk(key, pkg.packageId, next, data);
      if (!open) break;
      if (jumpTo !== null) continue; // a seek arrived while decrypting — drop this chunk
      await waitUpdate(sb);
      try {
        sb.appendBuffer(plain);
        await waitUpdate(sb);
        next++;
      } catch (e) {
        if ((e as DOMException)?.name !== "QuotaExceededError") throw e;
        await sleep(400); // buffer full: trim below and try the same chunk again
      }
      // Keep only a short window decrypted behind the playhead.
      const start = sb.buffered.length ? sb.buffered.start(0) : 0;
      if (now - start > BEHIND_SECONDS * 2 && !sb.updating) { sb.remove(0, now - BEHIND_SECONDS); await waitUpdate(sb); }
    }
  } finally {
    el?.removeEventListener("seeking", onSeeking);
  }
}

// ---------------- route 3: current track in memory (last resort) ----------------
async function memoryUrlFor(pkg: SecurePackage): Promise<string | null> {
  const cached = memory.get(pkg.packageId);
  if (cached) return cached;
  const device = await store.getDevice();
  if (!device || !pkg.licence) return null;
  const key = await unwrapContentKey(device.privateKey, pkg.packageId, pkg.licence);
  const parts: ArrayBuffer[] = [];
  for (let i = 0; i < pkg.chunkCount; i++) {
    const data = await store.getChunk(pkg, i);
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
  mseUrls.forEach((u) => URL.revokeObjectURL(u));
  mseUrls.clear();
}
