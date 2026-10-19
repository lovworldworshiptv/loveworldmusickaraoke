/**
 * Offline downloads — public API used across the app.
 * New downloads are saved in the encrypted, device-bound format
 * (src/lib/secureDownloads). Older plain downloads stay playable until they
 * have been re-saved securely in the background, then they are deleted.
 */
import { supabase } from "@/integrations/supabase/client";
import * as secureStore from "@/lib/secureDownloads/store";
import { enqueue, removeSecure } from "@/lib/secureDownloads/engine";
import { getSecurePlayableUrl } from "@/lib/secureDownloads/playback";
import { legacyAudioUrl, legacyInstrumentalUrl, legacyVideoUrl, legacyMeta, legacyTrack, removeLegacy } from "@/lib/secureDownloads/legacy";
import type { DownloadedTrack } from "@/lib/secureDownloads/types";

export type { DownloadedTrack };

async function currentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function preferredLanguage(uid: string): Promise<string | undefined> {
  const { data } = await supabase.from("user_preferences").select("preferred_languages").eq("user_id", uid).maybeSingle();
  return (data?.preferred_languages as string[] | undefined)?.[0];
}

/**
 * Save a song (with its karaoke track and video when available) for offline use.
 * Resolves once every part is encrypted and stored on this device.
 */
export async function saveDownload(
  songId: string,
  _audioUrl: string,
  meta: DownloadedTrack,
  _instrumentalUrl?: string,
): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sign in to save songs for offline listening");
  const language = await preferredLanguage(uid).catch(() => undefined);
  await enqueue({ ...meta, id: songId, downloadedAt: meta.downloadedAt || Date.now() }, { priority: 0, source: "user", language });
}

const readySecure = async (songId: string) => {
  const item = await secureStore.getItem(songId).catch(() => null);
  return item && item.status === "ready" ? item : null;
};

export async function getDownloadedAudioUrl(songId: string) {
  if (await readySecure(songId)) return getSecurePlayableUrl(songId, "audio");
  return legacyAudioUrl(songId).catch(() => null);
}
export async function getDownloadedInstrumentalUrl(songId: string) {
  if (await readySecure(songId)) return getSecurePlayableUrl(songId, "instrumental");
  return legacyInstrumentalUrl(songId).catch(() => null);
}
export async function getDownloadedVideoUrl(songId: string) {
  if (await readySecure(songId)) return getSecurePlayableUrl(songId, "video");
  return legacyVideoUrl(songId).catch(() => null);
}

export async function getDownloadedTrack(songId: string): Promise<DownloadedTrack | null> {
  const item = await readySecure(songId);
  if (item) return item.meta;
  return legacyTrack(songId).catch(() => null);
}

/** Everything playable on this device (secure first, then not-yet-migrated older copies). */
export async function getDownloadedMeta(): Promise<DownloadedTrack[]> {
  const items = await secureStore.getItems().catch(() => []);
  const ready = items.filter((i) => i.status === "ready").map((i) => i.meta);
  const ids = new Set(ready.map((t) => t.id));
  const legacy = (await legacyMeta().catch(() => [])).filter((t) => !ids.has(t.id));
  return [...ready, ...legacy].sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
}

export async function isDownloaded(songId: string): Promise<boolean> {
  return !!(await getDownloadedTrack(songId));
}

/** Remove from this device and from the account library (all devices). */
export async function removeDownload(songId: string): Promise<void> {
  await removeSecure(songId);
  await removeLegacy(songId).catch(() => undefined);
  const uid = await currentUserId();
  if (uid && navigator.onLine) {
    // Soft delete, so the removal reaches every device (they listen for changes).
    await supabase.from("downloads").update({ deleted_at: new Date().toISOString() }).eq("user_id", uid).eq("song_id", songId);
  }
}

/** Songs saved on the account (any device) that are not yet stored on this one. */
export async function getCloudOnlyDownloads(userId: string) {
  const local = new Set([
    ...(await secureStore.getItems().catch(() => [])).map((i) => i.songId),
    ...(await legacyMeta().catch(() => [])).map((t) => t.id),
  ]);
  const { data } = await supabase.from("downloads")
    .select("song_id, downloaded_at, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, duration_seconds, album, is_free_download)")
    .eq("user_id", userId).is("deleted_at", null).order("downloaded_at", { ascending: false });
  return ((data || []) as any[]).filter((r) => r.songs && !local.has(r.song_id)).map((r) => r.songs);
}

/** Push older local downloads made before account sync existed up to the account. */
export async function syncLocalDownloadsToCloud(userId: string) {
  const local = await legacyMeta().catch(() => []);
  if (!local.length) return;
  await supabase.from("downloads").upsert(
    local.map((t) => ({ user_id: userId, song_id: t.id })),
    { onConflict: "user_id,song_id", ignoreDuplicates: true },
  );
}
