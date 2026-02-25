/**
 * PWA Offline Download System using IndexedDB
 * Stores audio blobs and lyrics for offline playback.
 * Native (Capacitor) uses nativeService.ts instead.
 */

const DB_NAME = "lwm_karaoke_offline";
const DB_VERSION = 1;
const STORE_NAME = "downloads";

interface OfflineTrack {
  songId: string;
  title: string;
  artist: string;
  coverUrl?: string;
  lyricsLrc?: string;
  audioBlob: Blob;
  downloadedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "songId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineTrack(
  songId: string,
  audioBlob: Blob,
  meta: { title: string; artist: string; coverUrl?: string; lyricsLrc?: string }
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      songId,
      audioBlob,
      title: meta.title,
      artist: meta.artist,
      coverUrl: meta.coverUrl,
      lyricsLrc: meta.lyricsLrc,
      downloadedAt: new Date().toISOString(),
    } as OfflineTrack);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineTrack(songId: string): Promise<OfflineTrack | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(songId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineTrack(songId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(songId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllOfflineTracks(): Promise<Omit<OfflineTrack, "audioBlob">[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const tracks = (req.result as OfflineTrack[]).map(({ audioBlob, ...rest }) => rest);
      resolve(tracks);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function isTrackOffline(songId: string): Promise<boolean> {
  const track = await getOfflineTrack(songId);
  return !!track;
}

export function getOfflineAudioUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
