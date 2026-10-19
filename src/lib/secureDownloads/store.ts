/**
 * IndexedDB storage for encrypted offline downloads. Only ciphertext chunks,
 * wrapped licences and the non-extractable device key are stored here.
 * The service worker reads the same database to stream playback.
 */
import type { DeviceRecord, SecureItem } from "./types";

export const SECURE_DB = "lmk_secure_downloads";
const VERSION = 1;
const DEVICE = "device";
const ITEMS = "items";
const CHUNKS = "chunks";

let dbPromise: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(SECURE_DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DEVICE)) db.createObjectStore(DEVICE);
        if (!db.objectStoreNames.contains(ITEMS)) db.createObjectStore(ITEMS, { keyPath: "songId" });
        if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});
const result = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const chunkKey = (packageId: string, index: number) => `${packageId}:${String(index).padStart(6, "0")}`;
const chunkRange = (packageId: string) => IDBKeyRange.bound(`${packageId}:`, `${packageId}:~`);

export async function getDevice(): Promise<DeviceRecord | null> {
  const db = await open();
  return (await result(db.transaction(DEVICE).objectStore(DEVICE).get("current"))) ?? null;
}
export async function putDevice(d: DeviceRecord) {
  const db = await open();
  const tx = db.transaction(DEVICE, "readwrite");
  tx.objectStore(DEVICE).put(d, "current");
  await done(tx);
}

export async function getItems(): Promise<SecureItem[]> {
  const db = await open();
  return result(db.transaction(ITEMS).objectStore(ITEMS).getAll());
}
export async function getItem(songId: string): Promise<SecureItem | null> {
  const db = await open();
  return (await result(db.transaction(ITEMS).objectStore(ITEMS).get(songId))) ?? null;
}
export async function putItem(item: SecureItem) {
  const db = await open();
  const tx = db.transaction(ITEMS, "readwrite");
  tx.objectStore(ITEMS).put(item);
  await done(tx);
}

export async function putChunk(packageId: string, index: number, data: ArrayBuffer) {
  const db = await open();
  const tx = db.transaction(CHUNKS, "readwrite");
  tx.objectStore(CHUNKS).put(data, chunkKey(packageId, index));
  await done(tx);
}
export async function getChunk(packageId: string, index: number): Promise<ArrayBuffer | null> {
  const db = await open();
  return (await result(db.transaction(CHUNKS).objectStore(CHUNKS).get(chunkKey(packageId, index)))) ?? null;
}
export async function storedChunkIndices(packageId: string): Promise<Set<number>> {
  const db = await open();
  const keys = await result(db.transaction(CHUNKS).objectStore(CHUNKS).getAllKeys(chunkRange(packageId)));
  return new Set(keys.map((k) => Number(String(k).split(":")[1])));
}

/** Remove an item and every encrypted chunk that belongs to it. */
export async function deleteItem(item: SecureItem) {
  const db = await open();
  const tx = db.transaction([ITEMS, CHUNKS], "readwrite");
  for (const p of item.packages) tx.objectStore(CHUNKS).delete(chunkRange(p.packageId));
  tx.objectStore(ITEMS).delete(item.songId);
  await done(tx);
}

export async function wipeAll() {
  const db = await open();
  const tx = db.transaction([DEVICE, ITEMS, CHUNKS], "readwrite");
  tx.objectStore(DEVICE).clear();
  tx.objectStore(ITEMS).clear();
  tx.objectStore(CHUNKS).clear();
  await done(tx);
}
