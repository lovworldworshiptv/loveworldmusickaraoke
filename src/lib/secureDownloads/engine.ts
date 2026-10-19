/**
 * Secure offline download engine.
 * Persistent, resumable queue: each 1 MB encrypted chunk is verified and saved
 * before the next is requested, so interrupted downloads resume where they stopped.
 */
import { supabase } from "@/integrations/supabase/client";
import * as store from "./store";
import { offlineApi, ApiError } from "./api";
import { generateDeviceKeys, unwrapContentKey, decryptChunk, GCM_TAG_BYTES } from "./crypto";
import { legacyMeta, removeLegacy, wipeLegacy } from "./legacy";
import { clearPlaybackMemory } from "./playback";
import {
  sortQueue, isMeteredConnection, isKnownUnmetered, hasRoomFor, needsRenewal, isLicenceValid,
  plainChunkLength, estimateSongBytes,
} from "./policy";
import type { DeviceInfo, DeviceRecord, DownloadedTrack, SecureItem, SecurePackage, SecureKind, WrappedLicence } from "./types";

const CONCURRENT_CHUNKS = 2;
const MAX_CHUNK_RETRIES = 5;
const URL_BATCH = 32;
const PREPARE_POLL_MS = 3000;
const PREPARE_MAX_POLLS = 200;
const LICENCE_KEY = "lmk_offline_licenses";
const PAUSED_KEY = "lmk_dl_paused";
const CELLULAR_KEY = "lmk_dl_allow_cellular";
const restoreChoiceKey = (uid: string) => `lmk_restore_choice:${uid}`;

export type WaitingFor = null | "connection" | "wifi" | "space" | "device_limit";
export interface RestorePlan { songs: CloudSong[]; bytes: number }
export interface EngineState {
  items: SecureItem[];
  progress: Record<string, { done: number; total: number }>;
  activeSongId: string | null;
  paused: boolean;
  allowCellular: boolean;
  waitingFor: WaitingFor;
  deviceLimit: DeviceInfo[] | null;
  restore: RestorePlan | null;
  restoreChoice: "all" | "later" | null;
}

type CloudSong = {
  id: string; title: string; artist: string; cover_url: string | null; lyrics_lrc: string | null;
  duration_seconds: number; album: string | null; is_free_download: boolean | null; instrumental_url: string | null;
  downloaded_at: string;
};

class Signal extends Error { constructor(public reason: "paused" | "offline" | "yield" | "cancelled" | "space") { super(reason); } }
export class DeviceLimitError extends Error { constructor(public devices: DeviceInfo[]) { super("device_limit"); } }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

let state: EngineState = {
  items: [], progress: {}, activeSongId: null,
  paused: ls.get(PAUSED_KEY) === "1", allowCellular: ls.get(CELLULAR_KEY) === "1",
  waitingFor: null, deviceLimit: null, restore: null, restoreChoice: null,
};
const listeners = new Set<() => void>();
const emit = (patch: Partial<EngineState> = {}) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getSnapshot = () => state;

const waiters = new Map<string, { resolve: () => void; reject: (e: Error) => void }[]>();
const settle = (songId: string, err?: Error) => {
  (waiters.get(songId) || []).forEach((w) => (err ? w.reject(err) : w.resolve()));
  waiters.delete(songId);
};

let userId: string | null = null;
let running = false;
let kickAgain = false;
let preempt = false;
const cancelled = new Set<string>();
let onlineBound = false;

const conn = () => (navigator as any).connection as { type?: string; saveData?: boolean } | undefined;

async function refreshItems() {
  const items = (await store.getItems().catch(() => [])).filter((i) => !userId || i.userId === userId);
  emit({ items });
}
async function save(item: SecureItem) {
  item.updatedAt = Date.now();
  await store.putItem(item);
  await refreshItems();
}

/** Mirror the device licence expiry for the existing offline-access checks. */
function mirrorLicence(item: SecureItem) {
  const audio = item.packages.find((p) => p.kind === "audio");
  if (!audio?.licence) return;
  try {
    const all = JSON.parse(ls.get(LICENCE_KEY) || "{}");
    const exp = audio.licence.expiresAt;
    all[item.songId] = {
      trackId: item.songId,
      subscriptionExpiryDate: new Date(new Date(exp).getTime() + 365 * 86400000).toISOString(),
      offlineLicenseExpiryDate: exp,
      lastValidatedAt: new Date().toISOString(),
    };
    ls.set(LICENCE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

// ---------------- device ----------------
const deviceLabel = () => {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${os} · ${br}`;
};

let devicePromise: Promise<DeviceRecord> | null = null;
export function ensureDevice(): Promise<DeviceRecord> {
  if (!devicePromise) {
    devicePromise = (async () => {
      if (!userId) throw new Error("Sign in to save songs for offline listening");
      const existing = await store.getDevice();
      if (existing && existing.userId === userId) return existing;
      if (existing) await wipeLocal(false);
      const keys = await generateDeviceKeys();
      try {
        const res = await offlineApi<{ device: { id: string } }>("register_device", {
          publicKeyJwk: keys.publicKeyJwk, label: deviceLabel(), userAgent: navigator.userAgent.slice(0, 400),
        });
        const rec: DeviceRecord = { deviceId: res.device.id, userId, privateKey: keys.privateKey, publicKeyJwk: keys.publicKeyJwk, createdAt: Date.now() };
        await store.putDevice(rec);
        emit({ deviceLimit: null, waitingFor: state.waitingFor === "device_limit" ? null : state.waitingFor });
        return rec;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          emit({ waitingFor: "device_limit", deviceLimit: e.body?.devices || [] });
          throw new DeviceLimitError(e.body?.devices || []);
        }
        throw e;
      }
    })().finally(() => { devicePromise = null; });
  }
  return devicePromise;
}

export async function listDevices() {
  const res = await offlineApi<{ devices: DeviceInfo[]; limit: number }>("devices");
  const mine = await store.getDevice().catch(() => null);
  return { ...res, currentId: mine && mine.userId === userId ? mine.deviceId : null };
}

export async function revokeDevice(deviceId: string) {
  const mine = await store.getDevice().catch(() => null);
  await offlineApi("revoke_device", { deviceId });
  if (mine?.deviceId === deviceId) await wipeLocal(true);
  if (state.waitingFor === "device_limit") { emit({ waitingFor: null, deviceLimit: null }); kick(); }
}

// ---------------- queue ----------------
export function enqueue(meta: DownloadedTrack, opts: { priority?: number; source?: SecureItem["source"]; addedAt?: number; language?: string } = {}) {
  const promise = new Promise<void>((resolve, reject) => {
    const list = waiters.get(meta.id) || [];
    list.push({ resolve, reject });
    waiters.set(meta.id, list);
  });
  (async () => {
    if (!userId) throw new Error("Sign in to save songs for offline listening");
    const existing = await store.getItem(meta.id);
    if (existing?.status === "ready") { settle(meta.id); return; }
    const priority = opts.priority ?? 0;
    const item: SecureItem = existing
      ? { ...existing, status: existing.status === "locked" ? "queued" : existing.status === "failed" || existing.status === "paused" ? "queued" : existing.status, priority: Math.min(existing.priority, priority), error: undefined }
      : {
        songId: meta.id, userId, meta, language: opts.language, status: "queued", priority,
        source: opts.source ?? "user", packages: [], addedAt: opts.addedAt ?? Date.now(), updatedAt: Date.now(),
      };
    cancelled.delete(meta.id);
    await save(item);
    if (item.source !== "legacy") {
      await supabase.from("downloads").upsert({ user_id: userId, song_id: meta.id }, { onConflict: "user_id,song_id", ignoreDuplicates: true });
    }
    if (priority === 0 && state.activeSongId && state.activeSongId !== meta.id) preempt = true;
    kick();
  })().catch((e) => settle(meta.id, e instanceof Error ? e : new Error(String(e))));
  return promise;
}

export function setPaused(paused: boolean) {
  ls.set(PAUSED_KEY, paused ? "1" : "0");
  emit({ paused });
  if (!paused) kick();
}
export function setAllowCellular(allow: boolean) {
  ls.set(CELLULAR_KEY, allow ? "1" : "0");
  emit({ allowCellular: allow });
  if (allow) kick();
}
export async function retry(songId: string) {
  const item = await store.getItem(songId);
  if (!item) return;
  await save({ ...item, status: "queued", error: undefined });
  if (state.waitingFor === "space") emit({ waitingFor: null });
  kick();
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function checkpoint(songId: string) {
  if (cancelled.has(songId)) throw new Signal("cancelled");
  if (state.paused) throw new Signal("paused");
  if (!navigator.onLine) throw new Signal("offline");
  if (preempt) { preempt = false; throw new Signal("yield"); }
}

async function kick() {
  if (running) { kickAgain = true; return; }
  if (!userId) return;
  running = true;
  try {
    while (true) {
      kickAgain = false;
      if (state.paused) break;
      if (!navigator.onLine) { emit({ waitingFor: "connection" }); break; }
      const pending = sortQueue((await store.getItems()).filter((i) =>
        i.userId === userId && (i.status === "queued" || i.status === "preparing" || i.status === "downloading")));
      if (!pending.length) { if (state.waitingFor !== "device_limit") emit({ waitingFor: null }); break; }
      const metered = isMeteredConnection(conn());
      const next = pending.find((i) => i.source === "user" || !metered || state.allowCellular);
      if (!next) { emit({ waitingFor: "wifi" }); break; }
      emit({ activeSongId: next.songId, waitingFor: state.waitingFor === "device_limit" ? "device_limit" : null });
      try {
        await processItem(next);
      } catch (e) {
        const stop = await handleFailure(next, e);
        if (stop) break;
      }
    }
  } finally {
    running = false;
    emit({ activeSongId: null });
    if (kickAgain) kick();
  }
}

/** Returns true when the whole queue should stop for now. */
async function handleFailure(item: SecureItem, e: unknown): Promise<boolean> {
  const fresh = (await store.getItem(item.songId)) || item;
  if (e instanceof Signal) {
    if (e.reason === "cancelled") return false;
    if (e.reason === "yield") return false;
    if (e.reason === "offline") { emit({ waitingFor: "connection" }); return true; }
    if (e.reason === "space") {
      await save({ ...fresh, status: "paused", error: "Not enough space on this device" });
      emit({ waitingFor: "space" });
      settle(item.songId, new Error("Not enough space on this device"));
      return true;
    }
    return true; // paused
  }
  if (e instanceof DeviceLimitError) { settle(item.songId, new Error("Too many devices — remove one to continue")); return true; }
  if (!navigator.onLine || e instanceof TypeError) { emit({ waitingFor: "connection" }); return true; }
  if (e instanceof ApiError && e.body?.error === "device_revoked") {
    await wipeLocal(false);
    settle(item.songId, new Error("This device was removed from your account"));
    return true;
  }
  const notEntitled = e instanceof ApiError && (e.status === 403 || e.body?.error === "not_entitled");
  if (notEntitled && item.source === "legacy") {
    await store.deleteItem(fresh); // keep the older copy as it was
    await refreshItems();
    return false;
  }
  const message = notEntitled ? "Premium is needed to save this song" : (e as Error)?.message || "Download failed";
  await save({ ...fresh, status: "failed", error: message });
  settle(item.songId, new Error(message));
  return false;
}

async function prepare(item: SecureItem) {
  for (let i = 0; i < PREPARE_MAX_POLLS; i++) {
    checkpoint(item.songId);
    const res = await offlineApi<{ packages: any[]; lyrics: { lrc: string | null; text: string | null } | null }>("prepare", {
      songId: item.songId, ...(item.language ? { language: item.language } : {}),
    });
    if (!res.packages.some((p) => p.status === "preparing")) return res;
    await sleep(PREPARE_POLL_MS);
  }
  throw new Error("Preparing this download is taking longer than usual — it will continue later");
}

async function licence(item: SecureItem, device: DeviceRecord, pkgs: SecurePackage[]) {
  const res = await offlineApi<{ licences: (WrappedLicence & { packageId: string })[]; denied: string[] }>("licence", {
    deviceId: device.deviceId, packageIds: pkgs.map((p) => p.packageId),
  });
  for (const l of res.licences) {
    const p = item.packages.find((x) => x.packageId === l.packageId);
    if (p) p.licence = { licenceId: l.licenceId, ephemeralPublicKey: l.ephemeralPublicKey, iv: l.iv, wrappedKey: l.wrappedKey, expiresAt: l.expiresAt };
  }
  return res;
}

async function processItem(item: SecureItem) {
  const device = await ensureDevice();
  checkpoint(item.songId);

  if (!item.packages.length) {
    await save({ ...item, status: "preparing" });
    const res = await prepare(item);
    const audio = res.packages.find((p) => p.kind === "audio");
    if (!audio || audio.status !== "ready") throw new Error(audio?.error ? "This song could not be prepared right now" : "No audio available");
    const ready = res.packages.filter((p) => p.status === "ready");
    item.packages = ready.map((p) => ({
      packageId: p.id, kind: p.kind as SecureKind, mimeType: p.mimeType || (p.kind === "video" ? "video/mp4" : "audio/mpeg"),
      chunkSize: p.chunkSize, chunkCount: p.chunkCount, byteLength: p.byteLength,
    }));
    const video = ready.find((p) => p.kind === "video");
    item.meta = {
      ...item.meta,
      hasInstrumental: ready.some((p) => p.kind === "instrumental"),
      video: video?.meta || undefined,
      lyricsLrc: res.lyrics?.lrc || item.meta.lyricsLrc,
    };
    await save(item);
  }

  const stale = item.packages.filter((p) => !isLicenceValid(p.licence?.expiresAt, Date.now() + 60000));
  if (stale.length) {
    await licence(item, device, stale);
    item.packages = item.packages.filter((p) => p.kind === "audio" || p.licence);
    if (!item.packages.find((p) => p.kind === "audio")?.licence) throw new ApiError("not_entitled", 403, { error: "not_entitled" });
    await save(item);
  }

  const total = item.packages.reduce((s, p) => s + p.byteLength, 0);
  const haveSets = await Promise.all(item.packages.map((p) => store.storedChunkIndices(p.packageId)));
  let doneBytes = item.packages.reduce((s, p, i) =>
    s + [...haveSets[i]].reduce((t, idx) => t + plainChunkLength(idx, p.chunkSize, p.chunkCount, p.byteLength), 0), 0);
  const est = await navigator.storage?.estimate?.().catch(() => null);
  if (!hasRoomFor(est ?? null, total - doneBytes)) throw new Signal("space");
  navigator.storage?.persist?.().catch(() => undefined);

  await save({ ...item, status: "downloading" });
  const setProgress = () => emit({ progress: { ...state.progress, [item.songId]: { done: doneBytes, total } } });
  setProgress();

  for (let pi = 0; pi < item.packages.length; pi++) {
    const pkg = item.packages[pi];
    const missing = Array.from({ length: pkg.chunkCount }, (_, i) => i).filter((i) => !haveSets[pi].has(i));
    if (!missing.length) continue;
    const key = await unwrapContentKey(device.privateKey, pkg.packageId, pkg.licence!);
    let cursor = 0;
    while (cursor < missing.length) {
      checkpoint(item.songId);
      const from = missing[cursor];
      const { urls } = await offlineApi<{ urls: { index: number; url: string }[] }>("chunk_urls", {
        deviceId: device.deviceId, packageId: pkg.packageId, from, count: URL_BATCH,
      });
      const urlMap = new Map(urls.map((u) => [u.index, u.url]));
      const batch: number[] = [];
      while (cursor < missing.length && missing[cursor] < from + URL_BATCH) batch.push(missing[cursor++]);
      let next = 0;
      const worker = async () => {
        while (next < batch.length) {
          const idx = batch[next++];
          await fetchChunk(item.songId, device, pkg, key, idx, urlMap.get(idx));
          doneBytes += plainChunkLength(idx, pkg.chunkSize, pkg.chunkCount, pkg.byteLength);
          setProgress();
        }
      };
      await Promise.all(Array.from({ length: CONCURRENT_CHUNKS }, worker));
    }
  }

  const finished = { ...item, status: "ready" as const, error: undefined };
  await save(finished);
  mirrorLicence(finished);
  await removeLegacy(item.songId).catch(() => undefined);
  const { [item.songId]: _drop, ...rest } = state.progress;
  emit({ progress: rest });
  settle(item.songId);
}

async function fetchChunk(songId: string, device: DeviceRecord, pkg: SecurePackage, key: CryptoKey, idx: number, url?: string) {
  const expected = plainChunkLength(idx, pkg.chunkSize, pkg.chunkCount, pkg.byteLength) + GCM_TAG_BYTES;
  let signed = url;
  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    checkpoint(songId);
    try {
      if (!signed) {
        const { urls } = await offlineApi<{ urls: { index: number; url: string }[] }>("chunk_urls", {
          deviceId: device.deviceId, packageId: pkg.packageId, from: idx, count: 1,
        });
        signed = urls[0]?.url;
        if (!signed) throw new Error("Missing chunk");
      }
      const res = await fetch(signed, { cache: "no-store" });
      if (res.status === 400 || res.status === 403) { signed = undefined; throw new Error("Link expired"); }
      if (!res.ok) throw new Error(`Chunk ${idx} failed (${res.status})`);
      const data = await res.arrayBuffer();
      if (data.byteLength !== expected) throw new Error("Incomplete chunk");
      await decryptChunk(key, pkg.packageId, idx, data); // integrity check before saving
      if (cancelled.has(songId)) throw new Signal("cancelled");
      await store.putChunk(pkg.packageId, idx, data);
      return;
    } catch (e) {
      if (e instanceof Signal || e instanceof ApiError) throw e;
      if (!navigator.onLine) throw new Signal("offline");
      if (attempt === MAX_CHUNK_RETRIES) throw e;
      await sleep(Math.min(16000, 1000 * 2 ** attempt));
    }
  }
}

// ---------------- removal / wipe ----------------
export async function removeSecure(songId: string) {
  cancelled.add(songId);
  const item = await store.getItem(songId);
  if (item) await store.deleteItem(item);
  const { [songId]: _drop, ...rest } = state.progress;
  emit({ progress: rest });
  settle(songId, new Error("Download cancelled"));
  await refreshItems();
}

async function wipeLocal(revoked: boolean) {
  cancelled.clear();
  await store.wipeAll().catch(() => undefined);
  clearPlaybackMemory();
  await wipeLegacy();
  ls.del(LICENCE_KEY);
  navigator.serviceWorker?.controller?.postMessage({ type: "LMK_OFFLINE_KEYS_CLEAR" });
  emit({ items: [], progress: {}, restore: null, waitingFor: null, deviceLimit: null });
  if (revoked) window.dispatchEvent(new CustomEvent("lmk-offline-device-revoked"));
}

/** Sign-out: free the device slot and remove everything stored for offline use. */
export async function signOutCleanup() {
  const device = await store.getDevice().catch(() => null);
  if (device && navigator.onLine) {
    await Promise.race([offlineApi("revoke_device", { deviceId: device.deviceId }).catch(() => undefined), sleep(2500)]);
  }
  await wipeLocal(false);
  userId = null;
}

// ---------------- licences ----------------
export type RenewResult = "renewed" | "denied" | "not_secure" | "offline";
export async function renewSongLicence(songId: string): Promise<RenewResult> {
  const item = await store.getItem(songId);
  if (!item || item.status !== "ready" && item.status !== "locked") return "not_secure";
  if (!navigator.onLine) return "offline";
  try {
    const device = await ensureDevice();
    const res = await licence(item, device, item.packages);
    const audio = item.packages.find((p) => p.kind === "audio");
    const ok = !!audio && !res.denied.includes(audio.packageId) && isLicenceValid(audio.licence?.expiresAt);
    const updated = { ...item, status: ok ? "ready" as const : "locked" as const, error: ok ? undefined : "Premium is needed to keep this offline" };
    await save(updated);
    if (ok) mirrorLicence(updated);
    return ok ? "renewed" : "denied";
  } catch (e) {
    if (e instanceof ApiError && e.body?.error === "device_revoked") { await wipeLocal(true); return "denied"; }
    return "offline";
  }
}

async function renewDueLicences() {
  const items = (await store.getItems()).filter((i) => i.userId === userId && i.status === "ready");
  for (const i of items) {
    const audio = i.packages.find((p) => p.kind === "audio");
    if (needsRenewal(audio?.licence?.expiresAt)) await renewSongLicence(i.songId);
  }
}

// ---------------- account sync & restore ----------------
async function cloudLibrary(): Promise<CloudSong[] | null> {
  if (!userId) return null;
  const { data, error } = await supabase.from("downloads")
    .select("song_id, downloaded_at, songs(id, title, artist, cover_url, lyrics_lrc, duration_seconds, album, is_free_download, instrumental_url)")
    .eq("user_id", userId).order("downloaded_at", { ascending: false });
  if (error) return null;
  return ((data || []) as any[]).filter((r) => r.songs).map((r) => ({ ...r.songs, downloaded_at: r.downloaded_at }));
}

const toMeta = (s: CloudSong): DownloadedTrack => ({
  id: s.id, title: s.title, artist: s.artist, coverUrl: s.cover_url ?? undefined, lyricsLrc: s.lyrics_lrc ?? undefined,
  durationSeconds: s.duration_seconds, album: s.album ?? undefined, isFreeDownload: !!s.is_free_download,
  downloadedAt: new Date(s.downloaded_at).getTime(),
});

export async function syncAccount() {
  if (!userId || !navigator.onLine) return;
  const cloud = await cloudLibrary();
  if (!cloud) return;
  const cloudIds = new Set(cloud.map((s) => s.id));
  const local = await store.getItems();
  // Removed on another device → remove here too.
  for (const i of local) {
    if (i.userId === userId && i.source !== "legacy" && !cloudIds.has(i.songId) && Date.now() - i.addedAt > 120000) {
      await store.deleteItem(i);
    }
  }
  const legacy = await legacyMeta().catch(() => [] as DownloadedTrack[]);
  const onDevice = new Set([...local.map((i) => i.songId), ...legacy.map((l) => l.id)]);
  const missing = cloud.filter((s) => !onDevice.has(s.id));
  const { data: sized } = missing.length
    ? await supabase.from("offline_packages").select("song_id, byte_length").in("song_id", missing.map((s) => s.id).slice(0, 500)).eq("status", "ready")
    : { data: [] as any[] };
  const known = new Map<string, number>();
  for (const r of (sized || []) as any[]) known.set(r.song_id, (known.get(r.song_id) || 0) + Number(r.byte_length || 0));
  const bytes = missing.reduce((s, m) => s + (known.get(m.id) || estimateSongBytes(m.duration_seconds, !!m.instrumental_url)), 0);
  const choice = (ls.get(restoreChoiceKey(userId)) as "all" | "later" | null) || null;
  emit({ restore: missing.length ? { songs: missing, bytes } : null, restoreChoice: choice });
  await refreshItems();
  // Safe full-history restore: automatic once chosen, or on a known Wi-Fi/wired
  // connection with enough space; otherwise the listener is asked first.
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const autoSafe = choice === null && isKnownUnmetered(conn()) && hasRoomFor(est ?? null, bytes);
  if (missing.length && (choice === "all" || autoSafe)) await restoreAll();
}

/** Queue every account download not yet on this device — newest first. */
export async function restoreAll(songIds?: string[]) {
  if (!userId) return;
  ls.set(restoreChoiceKey(userId), "all");
  const plan = state.restore;
  if (!plan) return;
  const chosen = songIds ? plan.songs.filter((s) => songIds.includes(s.id)) : plan.songs;
  for (const s of chosen) {
    enqueue(toMeta(s), { priority: 1, source: "restore", addedAt: new Date(s.downloaded_at).getTime() }).catch(() => undefined);
  }
  emit({ restore: null, restoreChoice: "all" });
}
export function restoreLater() {
  if (!userId) return;
  ls.set(restoreChoiceKey(userId), "later");
  emit({ restoreChoice: "later" });
}

/** Re-save older plain downloads in the encrypted format (oldest copy stays playable meanwhile). */
async function migrateLegacy() {
  const legacy = await legacyMeta().catch(() => [] as DownloadedTrack[]);
  if (!legacy.length) return;
  const local = new Set((await store.getItems()).map((i) => i.songId));
  for (const t of legacy) {
    if (!local.has(t.id)) enqueue(t, { priority: 2, source: "legacy", addedAt: t.downloadedAt }).catch(() => undefined);
  }
}

export async function initEngine(uid: string) {
  if (userId === uid) { kick(); return; }
  userId = uid;
  await refreshItems();
  if (!onlineBound) {
    onlineBound = true;
    window.addEventListener("online", () => { emit({ waitingFor: null }); bootOnline(); });
    (navigator as any).connection?.addEventListener?.("change", () => kick());
  }
  bootOnline();
}

async function bootOnline() {
  if (!userId || !navigator.onLine) { kick(); return; }
  const device = await store.getDevice().catch(() => null);
  if (device && device.userId === userId) {
    const res = await offlineApi<{ active: boolean }>("touch_device", { deviceId: device.deviceId }).catch(() => null);
    if (res && !res.active) { await wipeLocal(true); }
  }
  // Interrupted "preparing"/"downloading" items resume from their last saved chunk.
  await renewDueLicences().catch(() => undefined);
  await syncAccount().catch(() => undefined);
  await migrateLegacy().catch(() => undefined);
  kick();
}

export function stopEngine() {
  userId = null;
  emit({ items: [], progress: {}, restore: null, activeSongId: null });
}
