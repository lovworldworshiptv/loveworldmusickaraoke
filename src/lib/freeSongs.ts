/**
 * Songs marked "free" by admins (songs.is_free_download) are open to every listener —
 * listening, karaoke (incl. recording), video and offline saving — without Premium.
 * Many lists build player songs without the flag, so the set of free song IDs is
 * loaded once on demand (refreshed when older than a few minutes, no polling).
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";

const STALE_MS = 5 * 60 * 1000;
let ids: ReadonlySet<string> = new Set();
let loadedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** A song is free when its own flag says so or it's in the admin-managed free list. */
export function isFreeSong(song: { id?: string; isFreeDownload?: boolean | null } | null | undefined, freeIds: ReadonlySet<string>): boolean {
  if (!song) return false;
  return !!song.isFreeDownload || (!!song.id && freeIds.has(song.id));
}

/** Premium listeners can use everything; free listeners can use free songs. */
export function canUseSong(isPremium: boolean, song: { id?: string; isFreeDownload?: boolean | null } | null | undefined, freeIds: ReadonlySet<string>): boolean {
  return isPremium || isFreeSong(song, freeIds);
}

export function refreshFreeSongs(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < STALE_MS) return Promise.resolve();
  if (inflight) return inflight;
  inflight = fetchAllRows<{ id: string }>((from, to) =>
    supabase.from("songs").select("id").eq("is_free_download", true).order("id").range(from, to))
    .then((rows) => {
      ids = new Set(rows.map((r) => r.id));
      loadedAt = Date.now();
      listeners.forEach((l) => l());
    })
    .catch(() => undefined)
    .finally(() => { inflight = null; });
  return inflight;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => ids;

/** Current set of free song IDs (loads it the first time it's needed). */
export function useFreeSongIds(): ReadonlySet<string> {
  useEffect(() => { void refreshFreeSongs(); }, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
