import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import * as store from "./store";
import { chunkForTime, chunkStartTime, choosePlaybackRoute, downloadUiState, bulkProgress } from "./policy";
import type { SecureItem, SecurePackage } from "./types";

/** Minimal in-memory Origin Private File System. */
class FakeFile { constructor(public data: Uint8Array) {} get size() { return this.data.byteLength; } async arrayBuffer() { return this.data.slice().buffer; } }
class FakeFileHandle {
  kind = "file" as const;
  data = new Uint8Array(0);
  constructor(public name: string) {}
  async getFile() { return new FakeFile(this.data); }
  async createWritable() {
    let next = new Uint8Array(0);
    return {
      write: async (d: ArrayBuffer) => { next = new Uint8Array(d.slice(0)); },
      close: async () => { this.data = next; },
    };
  }
}
class FakeDir {
  kind = "directory" as const;
  children = new Map<string, FakeDir | FakeFileHandle>();
  constructor(public name: string) {}
  async getDirectoryHandle(n: string, o?: { create?: boolean }) {
    let c = this.children.get(n);
    if (!c) { if (!o?.create) throw new DOMException("missing", "NotFoundError"); c = new FakeDir(n); this.children.set(n, c); }
    return c as FakeDir;
  }
  async getFileHandle(n: string, o?: { create?: boolean }) {
    let c = this.children.get(n);
    if (!c) { if (!o?.create) throw new DOMException("missing", "NotFoundError"); c = new FakeFileHandle(n); this.children.set(n, c); }
    return c as FakeFileHandle;
  }
  async removeEntry(n: string) { if (!this.children.delete(n)) throw new DOMException("missing", "NotFoundError"); }
  async *entries() { for (const e of this.children) yield e; }
}

let root: FakeDir;
const pkg = (id: string, storage: "opfs" | "idb", chunkCount = 3): SecurePackage => ({
  packageId: id, kind: "audio", mimeType: "audio/mpeg", chunkSize: 4, chunkCount, byteLength: chunkCount * 4, storage,
});
const item = (songId: string, packages: SecurePackage[]): SecureItem => ({
  songId, userId: "u1", meta: { id: songId, title: songId, artist: "a", durationSeconds: 60, downloadedAt: 1 },
  status: "ready", priority: 0, source: "user", packages, addedAt: 1, updatedAt: 1,
});
const bytes = (...n: number[]) => new Uint8Array(n).buffer;

beforeEach(async () => {
  root = new FakeDir("");
  Object.defineProperty(navigator, "storage", { value: { getDirectory: async () => root }, configurable: true });
  (globalThis as any).FileSystemFileHandle = FakeFileHandle;
  store.resetOpfsProbe();
  await store.wipeAll();
});

describe("chunk storage: OPFS preferred, IndexedDB fallback", () => {
  it("uses OPFS for new downloads when the browser can write files there", async () => {
    expect(await store.preferredBackend()).toBe("opfs");
  });

  it("falls back to IndexedDB when OPFS can't be written", async () => {
    delete (globalThis as any).FileSystemFileHandle;
    store.resetOpfsProbe();
    expect(await store.preferredBackend()).toBe("idb");
  });

  it("writes and reads chunks in OPFS without touching IndexedDB", async () => {
    const p = pkg("p1", "opfs");
    await store.putChunk(p, 0, bytes(1, 2, 3, 4));
    await store.putChunk(p, 2, bytes(9, 9));
    expect(new Uint8Array((await store.getChunk(p, 0))!)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(await store.getChunk(p, 1)).toBeNull();
    expect([...(await store.storedChunkIndices(p))].sort()).toEqual([0, 2]);
    expect(await store.getChunk({ packageId: "p1", storage: "idb" }, 0)).toBeNull();
  });

  it("doesn't count an interrupted (empty) chunk file as saved, so resume fetches it again", async () => {
    const p = pkg("p2", "opfs");
    await store.putChunk(p, 0, bytes(1));
    const dir = await (await root.getDirectoryHandle(store.OPFS_DIR)).getDirectoryHandle("p2");
    await dir.getFileHandle("000001", { create: true }); // created, never written
    expect([...(await store.storedChunkIndices(p))]).toEqual([0]);
  });

  it("keeps older IndexedDB saves playable next to new OPFS saves", async () => {
    const oldPkg = { ...pkg("old", "idb"), storage: undefined };
    await store.putChunk(oldPkg, 0, bytes(5));
    await store.putChunk(pkg("new", "opfs"), 0, bytes(6));
    expect(new Uint8Array((await store.getChunk(oldPkg, 0))!)).toEqual(new Uint8Array([5]));
    expect(new Uint8Array((await store.getChunk(pkg("new", "opfs"), 0))!)).toEqual(new Uint8Array([6]));
  });

  it("removing a song deletes its chunk folder", async () => {
    const p = pkg("p3", "opfs");
    await store.putItem(item("s3", [p]));
    await store.putChunk(p, 0, bytes(1));
    await store.deleteItem(item("s3", [p]));
    expect(await store.getItem("s3")).toBeNull();
    expect((await store.storedChunkIndices(p)).size).toBe(0);
  });

  it("'Remove all downloads from this device' clears songs but keeps the device registration", async () => {
    await store.putDevice({ deviceId: "d1", userId: "u1", privateKey: {} as CryptoKey, publicKeyJwk: {}, createdAt: 1 });
    const p = pkg("p4", "opfs");
    await store.putItem(item("s4", [p]));
    await store.putChunk(p, 0, bytes(1));
    await store.wipeItems();
    expect(await store.getItems()).toEqual([]);
    expect((await store.storedChunkIndices(p)).size).toBe(0);
    expect((await store.getDevice())?.deviceId).toBe("d1");
  });
});

describe("playback without the offline helper", () => {
  it("maps a seek position to the chunk holding it and back", () => {
    const MB = 1048576;
    // 8 MB, 240 s song → 1 MB ≈ 30 s
    expect(chunkForTime(0, 240, 8 * MB, MB, 8)).toBe(0);
    expect(chunkForTime(95, 240, 8 * MB, MB, 8)).toBe(3);
    expect(chunkForTime(500, 240, 8 * MB, MB, 8)).toBe(7);
    expect(chunkStartTime(3, 240, 8 * MB, MB)).toBe(90);
  });

  it("prefers the helper stream, then chunk streaming, and opens a song in memory only when neither exists", () => {
    expect(choosePlaybackRoute({ helper: true, apple: false, mse: true, kind: "audio" })).toBe("stream");
    expect(choosePlaybackRoute({ helper: false, apple: false, mse: true, kind: "audio" })).toBe("mse");
    expect(choosePlaybackRoute({ helper: true, apple: true, mse: true, kind: "audio" })).toBe("mse");
    expect(choosePlaybackRoute({ helper: true, apple: true, mse: false, kind: "audio" })).toBe("stream");
    expect(choosePlaybackRoute({ helper: false, apple: false, mse: true, kind: "video" })).toBe("memory");
    expect(choosePlaybackRoute({ helper: false, apple: true, mse: false, kind: "audio" })).toBe("memory");
  });
});

describe("download button states", () => {
  it("covers idle, queued, downloading, paused, done, error and locked", () => {
    expect(downloadUiState(undefined, false)).toBe("idle");
    expect(downloadUiState("queued", false)).toBe("queued");
    expect(downloadUiState("downloading", false)).toBe("queued"); // interrupted, not the active one
    expect(downloadUiState("downloading", true)).toBe("downloading");
    expect(downloadUiState("preparing", true)).toBe("downloading");
    expect(downloadUiState("paused", false)).toBe("paused");
    expect(downloadUiState("ready", false)).toBe("done");
    expect(downloadUiState("failed", false)).toBe("error");
    expect(downloadUiState("locked", false)).toBe("locked");
  });
});

describe("Download all progress", () => {
  it("counts finished songs and the active song's bytes: '12 of 30'", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `s${i}`);
    const status = (id: string) => (Number(id.slice(1)) < 12 ? "ready" : Number(id.slice(1)) === 12 ? "downloading" : "queued");
    const p = bulkProgress(ids, status, (id) => (id === "s12" ? { done: 50, total: 100 } : undefined));
    expect(p.ready).toBe(12);
    expect(p.total).toBe(30);
    expect(p.pending).toBe(18);
    expect(p.percent).toBe(42); // (12 + 0.5) / 30
    expect(p.complete).toBe(false);
  });
  it("is complete only when every song is saved", () => {
    expect(bulkProgress(["a", "b"], () => "ready", () => undefined).complete).toBe(true);
    expect(bulkProgress(["a", "b"], (id) => (id === "a" ? "ready" : "failed"), () => undefined)).toMatchObject({ complete: false, failed: 1 });
  });
});
