/**
 * Offline Download Manager
 * Stores audio blobs and metadata in IndexedDB for offline playback.
 * No MP3 URLs are exposed — everything stays in-app.
 */

const DB_NAME = "lmk_downloads";
const DB_VERSION = 1;
const STORE_AUDIO = "audio";
const STORE_META = "meta";

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
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) db.createObjectStore(STORE_AUDIO);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fetchViaProxy(url: string): Promise<Blob> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const proxyUrl = `${supabaseUrl}/functions/v1/download-audio`;
  const resp = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "Unknown error");
    throw new Error(`Download proxy failed: ${err}`);
  }
  return resp.blob();
}

export async function saveDownload(
  songId: string,
  audioUrl: string,
  meta: DownloadedTrack,
  instrumentalUrl?: string
): Promise<void> {
  // Download main audio
  const blob = await fetchViaProxy(audioUrl);

  // Download instrumental if available
  let instrumentalBlob: Blob | null = null;
  if (instrumentalUrl) {
    try {
      instrumentalBlob = await fetchViaProxy(instrumentalUrl);
    } catch {
      // Non-fatal: instrumental download failed, continue with main audio
      console.warn("Instrumental download failed, skipping");
    }
  }

  const db = await openDB();
  const tx = db.transaction([STORE_AUDIO, STORE_META], "readwrite");
  tx.objectStore(STORE_AUDIO).put(blob, songId);
  if (instrumentalBlob) {
    tx.objectStore(STORE_AUDIO).put(instrumentalBlob, `${songId}_instrumental`);
  }
  tx.objectStore(STORE_META).put(meta, songId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDownloadedInstrumentalUrl(songId: string): Promise<string | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_AUDIO, "readonly");
  const req = tx.objectStore(STORE_AUDIO).get(`${songId}_instrumental`);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      if (req.result) resolve(URL.createObjectURL(req.result));
      else resolve(null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeDownload(songId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_AUDIO, STORE_META], "readwrite");
  tx.objectStore(STORE_AUDIO).delete(songId);
  tx.objectStore(STORE_AUDIO).delete(`${songId}_instrumental`);
  tx.objectStore(STORE_META).delete(songId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDownloadedMeta(): Promise<DownloadedTrack[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, "readonly");
  const store = tx.objectStore(STORE_META);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as DownloadedTrack[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getDownloadedAudioUrl(songId: string): Promise<string | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_AUDIO, "readonly");
  const store = tx.objectStore(STORE_AUDIO);
  return new Promise((resolve, reject) => {
    const req = store.get(songId);
    req.onsuccess = () => {
      if (req.result) {
        resolve(URL.createObjectURL(req.result));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function isDownloaded(songId: string): Promise<boolean> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, "readonly");
  const req = tx.objectStore(STORE_META).get(songId);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => resolve(false);
  });
}
