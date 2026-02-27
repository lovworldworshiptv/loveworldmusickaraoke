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

export async function saveDownload(
  songId: string,
  audioUrl: string,
  meta: DownloadedTrack
): Promise<void> {
  // Fetch audio as blob to prevent URL exposure
  // Use no-cors fallback if standard fetch fails (cross-origin storage buckets)
  let blob: Blob;
  try {
    const resp = await fetch(audioUrl, { mode: "cors" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    blob = await resp.blob();
  } catch {
    // Retry with XMLHttpRequest which handles CORS differently
    blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", audioUrl, true);
      xhr.responseType = "blob";
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
        else reject(new Error(`HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error downloading audio"));
      xhr.send();
    });
  }

  const db = await openDB();
  const tx = db.transaction([STORE_AUDIO, STORE_META], "readwrite");
  tx.objectStore(STORE_AUDIO).put(blob, songId);
  tx.objectStore(STORE_META).put(meta, songId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeDownload(songId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_AUDIO, STORE_META], "readwrite");
  tx.objectStore(STORE_AUDIO).delete(songId);
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
