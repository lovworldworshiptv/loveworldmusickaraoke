/**
 * Read-only access to the pre-encryption download store (lmk_downloads v2).
 * Kept so older downloads stay playable until they are re-saved securely,
 * after which the plain files are deleted.
 */
import type { DownloadedTrack } from "./types";

const DB_NAME = "lmk_downloads";
const DB_VERSION = 2;
const STORE_AUDIO = "audio";
const STORE_META = "meta";
const STORE_VIDEO = "video";

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

function getBlobUrl(store: string, key: string): Promise<string | null> {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ? URL.createObjectURL(req.result) : null);
    req.onerror = () => reject(req.error);
  }));
}

export const legacyAudioUrl = (songId: string) => getBlobUrl(STORE_AUDIO, songId);
export const legacyInstrumentalUrl = (songId: string) => getBlobUrl(STORE_AUDIO, `${songId}_instrumental`);
export const legacyVideoUrl = (songId: string) => getBlobUrl(STORE_VIDEO, songId);

export async function legacyMeta(): Promise<DownloadedTrack[]> {
  const db = await openDB();
  const req = db.transaction(STORE_META, "readonly").objectStore(STORE_META).getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as DownloadedTrack[]);
    req.onerror = () => reject(req.error);
  });
}

export async function legacyTrack(songId: string): Promise<DownloadedTrack | null> {
  const db = await openDB();
  const req = db.transaction(STORE_META, "readonly").objectStore(STORE_META).get(songId);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve((req.result as DownloadedTrack) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function removeLegacy(songId: string): Promise<void> {
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
}

export const wipeLegacy = () => new Promise<void>((resolve) => {
  const req = indexedDB.deleteDatabase(DB_NAME);
  req.onsuccess = req.onerror = req.onblocked = () => resolve();
});
