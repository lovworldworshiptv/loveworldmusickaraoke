/**
 * Storage for encrypted offline downloads.
 * - Chunks: Origin Private File System (OPFS) when the browser can write files there,
 *   otherwise IndexedDB. Each package records which one it uses (`storage`), so older
 *   IndexedDB saves keep working after OPFS becomes available.
 * - Items (manifest + wrapped licences) and the non-extractable device key: IndexedDB.
 * Only ciphertext is ever written. The service worker reads the same layout to stream playback
 * (keep public/serviceworker.js in step with OPFS_DIR / chunkFileName / chunkKey).
 */
import type { ChunkBackend, ChunkRef, DeviceRecord, SecureItem } from "./types";

export const SECURE_DB = "lmk_secure_downloads";
const VERSION = 1;
const DEVICE = "device";
const ITEMS = "items";
const CHUNKS = "chunks";
export const OPFS_DIR = "lmk-secure";

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
export const chunkFileName = (index: number) => String(index).padStart(6, "0");
const chunkRange = (packageId: string) => IDBKeyRange.bound(`${packageId}:`, `${packageId}:~`);

// ---------------- OPFS ----------------
type Dir = FileSystemDirectoryHandle & {
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  keys?: () => AsyncIterableIterator<string>;
};
const opfsRoot = async (): Promise<Dir | null> => {
  const getDirectory = (navigator.storage as any)?.getDirectory;
  if (typeof getDirectory !== "function") return null;
  try { return await (navigator.storage as any).getDirectory(); } catch { return null; }
};
async function baseDir(create: boolean): Promise<Dir | null> {
  const root = await opfsRoot();
  if (!root) return null;
  try { return (await root.getDirectoryHandle(OPFS_DIR, { create })) as Dir; } catch { return null; }
}
async function packageDir(packageId: string, create: boolean): Promise<Dir | null> {
  const base = await baseDir(create);
  if (!base) return null;
  try { return (await base.getDirectoryHandle(packageId, { create })) as Dir; } catch { return null; }
}
async function writeFile(dir: Dir, name: string, data: ArrayBuffer) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await (fh as any).createWritable();
  await w.write(data);
  await w.close(); // committed atomically: an interrupted write leaves an empty file, never a partial one
}

let opfsProbe: Promise<boolean> | null = null;
/** True when chunks can be written to OPFS from this page (needs createWritable; probed once). */
export function opfsWritable(): Promise<boolean> {
  if (!opfsProbe) {
    opfsProbe = (async () => {
      const g = globalThis as any;
      if (!g.FileSystemFileHandle?.prototype || typeof g.FileSystemFileHandle.prototype.createWritable !== "function") return false;
      const base = await baseDir(true);
      if (!base) return false;
      try {
        const probe = new Uint8Array([1, 2, 3, 4]).buffer;
        await writeFile(base, ".probe", probe);
        const back = await (await base.getFileHandle(".probe")).getFile();
        const ok = back.size === 4;
        await base.removeEntry(".probe").catch(() => undefined);
        return ok;
      } catch { return false; }
    })();
  }
  return opfsProbe;
}
/** Which backend new packages should use on this device. */
export const preferredBackend = async (): Promise<ChunkBackend> => ((await opfsWritable()) ? "opfs" : "idb");
/** Test hook: forget the cached OPFS probe. */
export const resetOpfsProbe = () => { opfsProbe = null; };

async function listDir(dir: Dir): Promise<{ name: string; handle: FileSystemHandle }[]> {
  const out: { name: string; handle: FileSystemHandle }[] = [];
  if (dir.entries) for await (const [name, handle] of dir.entries()) out.push({ name, handle });
  return out;
}

// ---------------- device & items ----------------
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

// ---------------- chunks ----------------
export async function putChunk(pkg: ChunkRef, index: number, data: ArrayBuffer) {
  if (pkg.storage === "opfs") {
    const dir = await packageDir(pkg.packageId, true);
    if (!dir) throw new Error("Device storage is unavailable");
    await writeFile(dir, chunkFileName(index), data);
    return;
  }
  const db = await open();
  const tx = db.transaction(CHUNKS, "readwrite");
  tx.objectStore(CHUNKS).put(data, chunkKey(pkg.packageId, index));
  await done(tx);
}

export async function getChunk(pkg: ChunkRef, index: number): Promise<ArrayBuffer | null> {
  if (pkg.storage === "opfs") {
    const dir = await packageDir(pkg.packageId, false);
    if (!dir) return null;
    try {
      const file = await (await dir.getFileHandle(chunkFileName(index))).getFile();
      return file.size ? await file.arrayBuffer() : null;
    } catch { return null; }
  }
  const db = await open();
  return (await result(db.transaction(CHUNKS).objectStore(CHUNKS).get(chunkKey(pkg.packageId, index)))) ?? null;
}

/** Chunk indexes already saved for a package (empty OPFS files from an interrupted write don't count). */
export async function storedChunkIndices(pkg: ChunkRef): Promise<Set<number>> {
  if (pkg.storage === "opfs") {
    const dir = await packageDir(pkg.packageId, false);
    if (!dir) return new Set();
    const out = new Set<number>();
    for (const { name, handle } of await listDir(dir)) {
      if (handle.kind !== "file" || !/^\d{6}$/.test(name)) continue;
      const file = await (handle as FileSystemFileHandle).getFile().catch(() => null);
      if (file && file.size > 0) out.add(Number(name));
    }
    return out;
  }
  const db = await open();
  const keys = await result(db.transaction(CHUNKS).objectStore(CHUNKS).getAllKeys(chunkRange(pkg.packageId)));
  return new Set(keys.map((k) => Number(String(k).split(":")[1])));
}

/** Remove an item and every encrypted chunk that belongs to it. */
export async function deleteItem(item: SecureItem) {
  const base = await baseDir(false);
  if (base) {
    for (const p of item.packages) if (p.storage === "opfs") await base.removeEntry(p.packageId, { recursive: true }).catch(() => undefined);
  }
  const db = await open();
  const tx = db.transaction([ITEMS, CHUNKS], "readwrite");
  for (const p of item.packages) tx.objectStore(CHUNKS).delete(chunkRange(p.packageId));
  tx.objectStore(ITEMS).delete(item.songId);
  await done(tx);
}

/** Remove saved songs and their chunks, keeping this device's registration. */
export async function wipeItems() {
  const root = await opfsRoot();
  if (root) await root.removeEntry(OPFS_DIR, { recursive: true }).catch(() => undefined);
  const db = await open();
  const tx = db.transaction([ITEMS, CHUNKS], "readwrite");
  tx.objectStore(ITEMS).clear();
  tx.objectStore(CHUNKS).clear();
  await done(tx);
}

export async function wipeAll() {
  await wipeItems();
  const db = await open();
  const tx = db.transaction(DEVICE, "readwrite");
  tx.objectStore(DEVICE).clear();
  await done(tx);
}

/** Diagnostics: how many packages on this device use each backend. */
export async function backendCounts() {
  const counts: Record<ChunkBackend, number> = { opfs: 0, idb: 0 };
  for (const i of await getItems()) for (const p of i.packages) counts[p.storage === "opfs" ? "opfs" : "idb"]++;
  return counts;
}
