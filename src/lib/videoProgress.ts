import { useSyncExternalStore } from "react";

/** Live state of the video on screen, shared with the Up Next sheet without re-rendering the player. */
export type VideoStatus = { time: number; dur: number; playing: boolean };

export interface VideoStatusStore {
  get(): VideoStatus;
  set(patch: Partial<VideoStatus>): void;
  subscribe(listener: () => void): () => void;
  /** Filled in by the video on screen. */
  controls: { toggle: () => void };
}

export function createVideoStatus(): VideoStatusStore {
  let state: VideoStatus = { time: 0, dur: 0, playing: false };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      if (next.time === state.time && next.dur === state.dur && next.playing === state.playing) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    controls: { toggle: () => {} },
  };
}

export function useVideoStatus(store: VideoStatusStore): VideoStatus {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

// --- How far each video was watched on this device (shown as a thin line on thumbnails) ---
const KEY = "lw-video-progress-v1";
const MAX_ENTRIES = 200;
type ProgressMap = Record<string, { t: number; d: number; at: number }>;

export function readVideoProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveVideoProgress(songId: string, time: number, dur: number) {
  if (!songId || !dur || !isFinite(dur)) return;
  try {
    const map = readVideoProgress();
    // Finished (or barely started) videos don't need a progress line.
    if (time / dur >= 0.95 || time < 5) delete map[songId];
    else map[songId] = { t: time, d: dur, at: Date.now() };
    const ids = Object.keys(map);
    if (ids.length > MAX_ENTRIES) {
      ids.sort((a, b) => map[a].at - map[b].at).slice(0, ids.length - MAX_ENTRIES).forEach((id) => delete map[id]);
    }
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* storage unavailable */ }
}

/** Fraction watched (0–1) or null when there is nothing saved. */
export function watchedFraction(map: ProgressMap, songId: string): number | null {
  const p = map[songId];
  if (!p || !p.d) return null;
  return Math.max(0, Math.min(1, p.t / p.d));
}
