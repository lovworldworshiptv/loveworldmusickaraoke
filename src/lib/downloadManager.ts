/**
 * Offline Download Manager
 * Stores song audio, instrumental (karaoke) and video blobs plus metadata in
 * IndexedDB for offline playback, and mirrors the list of downloaded songs to
 * the user's account so it follows them to any device they sign in on.
 */
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "lmk_downloads";
const DB_VERSION = 2;
const STORE_AUDIO = "audio";
const STORE_META = "meta";
const STORE_VIDEO = "video";

export interface DownloadedTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  lyricsLrc?: string;
  durationSeconds: number;
  album?: string;
  isFreeDownload?: boolean;
  downloadedAt: number;
  hasInstrumental?: boolean;
  video?: { id: string; video_type: string; language_code: string; offset_ms: number; thumbnail_url: string | null };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) db.createObjectStore(STORE_AUDIO);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      if (!db.objectStoreNames.contains(STORE_VIDEO)) db.createObjectStore(STORE_VIDEO);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fetchViaProxy(url: string): Promise<Blob> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const resp = await fetch(`${supabaseUrl}/functions/v1/download-audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "Unknown error");
    throw new Error(`Download proxy failed: ${err}`);
  }
  return resp.blob();
}

const isYouTube = (url: string) => /youtu\.?be/.test(url);

async function currentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function saveDownload(
  songId: string,
  audioUrl: string,
  meta: DownloadedTrack,
  instrumentalUrl?: string
): Promise<void> {
  const blob = await fetchViaProxy(audioUrl);

  // Look up the karaoke track and a downloadable video when not supplied.
  let instUrl = instrumentalUrl;
  let videoRow: (NonNullable<DownloadedTrack["video"]> & { video_url: string }) | null = null;
  try {
    const [songRes, vidRes] = await Promise.all([
      instUrl ? Promise.resolve(null) : supabase.from("songs").select("instrumental_url").eq("id", songId).maybeSingle(),
      supabase.from("song_videos").select("id, video_url, video_type, language_code, offset_ms, thumbnail_url")
        .eq("song_id", songId).eq("is_active", true),
    ]);
    if (songRes && "data" in songRes) instUrl = songRes.data?.instrumental_url ?? undefined;
    const order = ["official", "lyric", "live", "karaoke"];
    const vids = ((vidRes.data || []) as any[]).filter((v) => !isYouTube(v.video_url))
      .sort((a, b) => order.indexOf(a.video_type) - order.indexOf(b.video_type));
    videoRow = vids[0] ?? null;
  } catch { /* offline lookups are best-effort */ }

  const [instrumentalBlob, videoBlob] = await Promise.all([
    instUrl ? fetchViaProxy(instUrl).catch(() => null) : Promise.resolve(null),
    videoRow ? fetchViaProxy(videoRow.video_url).catch(() => null) : Promise.resolve(null),
  ]);

  const fullMeta: DownloadedTrack = {
    ...meta,
    hasInstrumental: !!instrumentalBlob,
    video: videoBlob && videoRow ? {
      id: videoRow.id, video_type: videoRow.video_type, language_code: videoRow.language_code,
      offset_ms: videoRow.offset_ms, thumbnail_url: videoRow.thumbnail_url,
    } : undefined,
  };

  const db = await openDB();
  const tx = db.transaction([STORE_AUDIO, STORE_META, STORE_VIDEO], "readwrite");
  tx.objectStore(STORE_AUDIO).put(blob, songId);
  if (instrumentalBlob) tx.objectStore(STORE_AUDIO).put(instrumentalBlob, `${songId}_instrumental`);
  if (videoBlob) tx.objectStore(STORE_VIDEO).put(videoBlob, songId);
  tx.objectStore(STORE_META).put(fullMeta, songId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Remember the download on the account so other devices can restore it.
  const uid = await currentUserId();
  if (uid) {
    await supabase.from("downloads").upsert({ user_id: uid, song_id: songId }, { onConflict: "user_id,song_id", ignoreDuplicates: true });
  }
}

function getBlobUrl(store: string, key: string): Promise<string | null> {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ? URL.createObjectURL(req.result) : null);
    req.onerror = () => reject(req.error);
  }));
}

export const getDownloadedInstrumentalUrl = (songId: string) => getBlobUrl(STORE_AUDIO, `${songId}_instrumental`);
export const getDownloadedAudioUrl = (songId: string) => getBlobUrl(STORE_AUDIO, songId);
export const getDownloadedVideoUrl = (songId: string) => getBlobUrl(STORE_VIDEO, songId);

export async function getDownloadedTrack(songId: string): Promise<DownloadedTrack | null> {
  const db = await openDB();
  const req = db.transaction(STORE_META, "readonly").objectStore(STORE_META).get(songId);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve((req.result as DownloadedTrack) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function removeDownload(songId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_AUDIO, STORE_META, STORE_VIDEO], "readwrite");
  tx.objectStore(STORE_AUDIO).delete(songId);
  tx.objectStore(STORE_AUDIO).delete(`${songId}_instrumental`);
  tx.objectStore(STORE_VIDEO).delete(songId);
  tx.objectStore(STORE_META).delete(songId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const uid = await currentUserId();
  if (uid && navigator.onLine) {
    await supabase.from("downloads").delete().eq("user_id", uid).eq("song_id", songId);
  }
}

export async function getDownloadedMeta(): Promise<DownloadedTrack[]> {
  const db = await openDB();
  const req = db.transaction(STORE_META, "readonly").objectStore(STORE_META).getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as DownloadedTrack[]);
    req.onerror = () => reject(req.error);
  });
}

export async function isDownloaded(songId: string): Promise<boolean> {
  return !!(await getDownloadedTrack(songId));
}

/** Songs saved on the account (any device) that are not yet stored on this one. */
export async function getCloudOnlyDownloads(userId: string) {
  const local = new Set((await getDownloadedMeta().catch(() => [])).map((t) => t.id));
  const { data } = await supabase.from("downloads")
    .select("song_id, downloaded_at, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, duration_seconds, album, is_free_download)")
    .eq("user_id", userId).order("downloaded_at", { ascending: false });
  return ((data || []) as any[]).filter((r) => r.songs && !local.has(r.song_id)).map((r) => r.songs);
}

/** Push local downloads made before account sync existed up to the account. */
export async function syncLocalDownloadsToCloud(userId: string) {
  const local = await getDownloadedMeta().catch(() => []);
  if (!local.length) return;
  await supabase.from("downloads").upsert(
    local.map((t) => ({ user_id: userId, song_id: t.id })),
    { onConflict: "user_id,song_id", ignoreDuplicates: true },
  );
}
