/**
 * Personal Studio store — keeps karaoke recordings on this device (IndexedDB)
 * so they survive beyond the 24h cloud window and play offline.
 */

const DB_NAME = "lmk_studio";
const DB_VERSION = 1;
const STORE_AUDIO = "audio";
const STORE_META = "meta";

export interface StudioRecording {
  id: string;
  songId: string;
  songTitle: string;
  caption?: string;
  durationSeconds?: number;
  sizeBytes: number;
  mimeType: string;
  createdAt: number;
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

export async function saveStudioRecording(
  blob: Blob,
  meta: Omit<StudioRecording, "id" | "sizeBytes" | "mimeType" | "createdAt"> & { id?: string; createdAt?: number },
): Promise<StudioRecording> {
  const rec: StudioRecording = {
    ...meta,
    id: meta.id ?? `${meta.songId}-${Date.now()}`,
    sizeBytes: blob.size,
    mimeType: blob.type || "audio/webm",
    createdAt: meta.createdAt ?? Date.now(),
  };
  const db = await openDB();
  const tx = db.transaction([STORE_AUDIO, STORE_META], "readwrite");
  tx.objectStore(STORE_AUDIO).put(blob, rec.id);
  tx.objectStore(STORE_META).put(rec, rec.id);
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  return rec;
}

export async function listStudioRecordings(): Promise<StudioRecording[]> {
  const db = await openDB();
  const req = db.transaction(STORE_META, "readonly").objectStore(STORE_META).getAll();
  const all = await new Promise<StudioRecording[]>((res, rej) => {
    req.onsuccess = () => res(req.result as StudioRecording[]);
    req.onerror = () => rej(req.error);
  });
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStudioRecordingBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  const req = db.transaction(STORE_AUDIO, "readonly").objectStore(STORE_AUDIO).get(id);
  return new Promise((res, rej) => {
    req.onsuccess = () => res((req.result as Blob) ?? null);
    req.onerror = () => rej(req.error);
  });
}

export async function renameStudioRecording(id: string, caption: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, "readwrite");
  const store = tx.objectStore(STORE_META);
  const req = store.get(id);
  req.onsuccess = () => { if (req.result) store.put({ ...req.result, caption }, id); };
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function deleteStudioRecording(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_AUDIO, STORE_META], "readwrite");
  tx.objectStore(STORE_AUDIO).delete(id);
  tx.objectStore(STORE_META).delete(id);
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export function formatBytes(n: number): string {
  if (!n) return "0 MB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
