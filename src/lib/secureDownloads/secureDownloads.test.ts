import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { generateDeviceKeys, unwrapContentKey, decryptChunk, chunkIv, chunkAad, toB64 } from "./crypto";
import {
  needsRenewal, isLicenceValid, sortQueue, isMeteredConnection, isKnownUnmetered, hasRoomFor,
  plainChunkLength, rangeToChunks, licenceBatches, DAY_MS, SPACE_HEADROOM_BYTES,
  missingChunks, parseRange, fetchVerified, reconcile,
} from "./policy";

const enc = new TextEncoder();
const NOW = Date.UTC(2026, 9, 19, 12);

beforeAll(() => {
  // jsdom lacks SubtleCrypto; use the same Web Crypto implementation browsers expose.
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
});

/** Mirror of the backend's licence wrapping, to prove device-side unwrapping matches it. */
async function serverWrap(devicePub: JsonWebKey, raw: Uint8Array<ArrayBuffer>, packageId: string, licenceId: string) {
  const pub = await crypto.subtle.importKey("jwk", devicePub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const eph = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const wk = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("lmk-offline-licence-v1"), info: enc.encode(licenceId) },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(packageId) }, wk, raw);
  return { licenceId, ephemeralPublicKey: await crypto.subtle.exportKey("jwk", eph.publicKey), iv: toB64(iv), wrappedKey: toB64(ct), expiresAt: new Date(NOW + DAY_MS).toISOString() };
}

/** Mirror of the backend's current AES-KW licence wrapping (ECDH P-256 → HKDF-SHA256 → AES-KW). */
async function serverWrapKw(devicePub: JsonWebKey, raw: Uint8Array<ArrayBuffer>, licenceId: string) {
  const pub = await crypto.subtle.importKey("jwk", devicePub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const eph = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const kek = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("lmk-offline-licence-v2"), info: enc.encode(licenceId) },
    base, { name: "AES-KW", length: 256 }, false, ["wrapKey"],
  );
  const content = await crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt"]);
  const wrapped = await crypto.subtle.wrapKey("raw", content, kek, "AES-KW");
  return { alg: "A256KW", licenceId, ephemeralPublicKey: await crypto.subtle.exportKey("jwk", eph.publicKey), iv: "", wrappedKey: toB64(wrapped), expiresAt: new Date(NOW + DAY_MS).toISOString() };
}

const MB = 1048576;
function randomBytes(n: number) {
  const u = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(u.subarray(i, i + 65536));
  return u;
}

describe("AES-KW licences and full-file round trip", () => {
  it("unwraps an AES-KW licence and restores a 3.5 MB file byte-for-byte from 1 MB chunks", async () => {
    const device = await generateDeviceKeys();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const content = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const file = randomBytes(Math.round(3.5 * MB));
    const chunks: ArrayBuffer[] = [];
    for (let i = 0, off = 0; off < file.length; i++, off += MB) {
      chunks.push(await crypto.subtle.encrypt({ name: "AES-GCM", iv: chunkIv(i), additionalData: chunkAad("pkg-big", i) }, content, file.subarray(off, off + MB)));
    }
    expect(chunks.length).toBe(4);
    expect(chunks[0].byteLength).toBe(MB + 16);
    const key = await unwrapContentKey(device.privateKey, "pkg-big", await serverWrapKw(device.publicKeyJwk, raw, "lic-kw"));
    expect(key.extractable).toBe(false);
    const out = new Uint8Array(file.length);
    let off = 0;
    for (let i = 0; i < chunks.length; i++) {
      const pt = new Uint8Array(await decryptChunk(key, "pkg-big", i, chunks[i]));
      out.set(pt, off); off += pt.length;
    }
    expect(off).toBe(file.length);
    expect(out.every((b, i) => b === file[i])).toBe(true);
  });

  it("detects a tampered chunk (one flipped byte) instead of playing it", async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const content = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: chunkIv(3), additionalData: chunkAad("p", 3) }, content, randomBytes(4096)));
    ct[100] ^= 0xff;
    await expect(decryptChunk(content, "p", 3, ct.buffer)).rejects.toBeTruthy();
  });

  it("serves the exact bytes of a range that spans chunk boundaries", async () => {
    const file = randomBytes(Math.round(2.5 * MB));
    const start = MB - 10, end = 2 * MB + 20;
    const { first, last, offset } = rangeToChunks(start, end, MB);
    const parts: Uint8Array[] = [];
    for (let i = first; i <= last; i++) parts.push(file.subarray(i * MB, Math.min(file.length, (i + 1) * MB)));
    const joined = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of parts) { joined.set(p, o); o += p.length; }
    const slice = joined.subarray(offset, offset + (end - start + 1));
    expect(slice.length).toBe(end - start + 1);
    expect(slice.every((b, i) => b === file[start + i])).toBe(true);
  });
});

describe("licence request batching", () => {
  it("keeps each request at 60 packages or fewer without splitting a song", () => {
    const songs = Array.from({ length: 50 }, (_, i) => ({ id: i, packages: [1, 2, 3] }));
    const batches = licenceBatches(songs, 60);
    expect(batches.length).toBe(3);
    expect(batches.every((b) => b.reduce((n, s) => n + s.packages.length, 0) <= 60)).toBe(true);
    expect(batches.flat().length).toBe(50);
  });
});

describe("device-bound encryption", () => {
  it("only the registered device can unwrap a licence and decrypt its chunks", async () => {
    const device = await generateDeviceKeys();
    const other = await generateDeviceKeys();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const content = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const plain = enc.encode("worship chunk 0");
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: chunkIv(0), additionalData: chunkAad("pkg-1", 0) }, content, plain);
    const lic = await serverWrap(device.publicKeyJwk, raw, "pkg-1", "lic-1");

    const key = await unwrapContentKey(device.privateKey, "pkg-1", lic);
    expect(new TextDecoder().decode(await decryptChunk(key, "pkg-1", 0, ct))).toBe("worship chunk 0");
    await expect(unwrapContentKey(other.privateKey, "pkg-1", lic)).rejects.toBeTruthy();
    // A chunk replayed at another position or package fails its integrity check.
    await expect(decryptChunk(key, "pkg-1", 1, ct)).rejects.toBeTruthy();
    await expect(decryptChunk(key, "pkg-2", 0, ct)).rejects.toBeTruthy();
  });

  it("never exposes the device private key", async () => {
    const device = await generateDeviceKeys();
    expect(device.privateKey.extractable).toBe(false);
    expect("d" in device.publicKeyJwk).toBe(false);
  });
});

describe("licence renewal", () => {
  it("renews silently within seven days of expiry", () => {
    expect(needsRenewal(new Date(NOW + 6 * DAY_MS).toISOString(), NOW)).toBe(true);
    expect(needsRenewal(new Date(NOW + 8 * DAY_MS).toISOString(), NOW)).toBe(false);
  });
  it("blocks playback once the licence has expired", () => {
    expect(isLicenceValid(new Date(NOW - 1000).toISOString(), NOW)).toBe(false);
    expect(isLicenceValid(new Date(NOW + 1000).toISOString(), NOW)).toBe(true);
  });
});

describe("historical restore order", () => {
  it("puts songs the listener asks for first, then newest saves first", () => {
    const order = sortQueue([
      { id: "old", priority: 1, addedAt: 1 },
      { id: "new", priority: 1, addedAt: 3 },
      { id: "tapped", priority: 0, addedAt: 0 },
      { id: "migrate", priority: 2, addedAt: 9 },
    ]).map((i) => i.id);
    expect(order).toEqual(["tapped", "new", "old", "migrate"]);
  });
  it("treats mobile data and data saver as metered, unknown connections as not known safe", () => {
    expect(isMeteredConnection({ type: "cellular" })).toBe(true);
    expect(isMeteredConnection({ type: "wifi", saveData: true })).toBe(true);
    expect(isKnownUnmetered({ type: "wifi" })).toBe(true);
    expect(isKnownUnmetered(undefined)).toBe(false);
  });
  it("requires the download size plus headroom to be free", () => {
    expect(hasRoomFor({ quota: 1000 + SPACE_HEADROOM_BYTES, usage: 0 }, 1000)).toBe(true);
    expect(hasRoomFor({ quota: 999 + SPACE_HEADROOM_BYTES, usage: 0 }, 1000)).toBe(false);
  });
});

describe("chunk layout", () => {
  it("maps byte ranges to 1 MB chunks", () => {
    const MB = 1048576;
    expect(rangeToChunks(0, MB - 1, MB)).toEqual({ first: 0, last: 0, offset: 0 });
    expect(rangeToChunks(MB + 5, 2 * MB + 10, MB)).toEqual({ first: 1, last: 2, offset: 5 });
    expect(plainChunkLength(2, MB, 3, 2749696)).toBe(2749696 - 2 * MB);
    expect(plainChunkLength(0, MB, 3, 2749696)).toBe(MB);
  });
});

describe("QA cases from the hardening brief", () => {
  async function encryptFile(file: Uint8Array<ArrayBuffer>, pkg: string) {
    const content = await crypto.subtle.importKey("raw", crypto.getRandomValues(new Uint8Array(32)), "AES-GCM", false, ["encrypt", "decrypt"]);
    const chunks: ArrayBuffer[] = [];
    for (let i = 0, off = 0; off < file.length; i++, off += MB) {
      chunks.push(await crypto.subtle.encrypt({ name: "AES-GCM", iv: chunkIv(i), additionalData: chunkAad(pkg, i) }, content, file.subarray(off, off + MB)));
    }
    return { content, chunks };
  }

  it("2: a chunk with one flipped byte fails its check and is fetched again", async () => {
    const { content, chunks } = await encryptFile(randomBytes(MB), "p2");
    const bad = new Uint8Array(chunks[0].slice(0)); bad[500] ^= 0x01;
    let calls = 0;
    const got = await fetchVerified(
      async () => (++calls === 1 ? bad.buffer : chunks[0]),
      (d) => decryptChunk(content, "p2", 0, d),
      { retries: 3, wait: async () => undefined },
    );
    expect(calls).toBe(2);
    expect(got).toBe(chunks[0]);
  });

  it("3: swapping two chunks fails because the chunk index is authenticated", async () => {
    const { content, chunks } = await encryptFile(randomBytes(2 * MB), "p3");
    await expect(decryptChunk(content, "p3", 0, chunks[1])).rejects.toBeTruthy();
    await expect(decryptChunk(content, "p3", 1, chunks[0])).rejects.toBeTruthy();
  });

  it("6: ranges 0-99, across a chunk boundary, the last 100 bytes and open-ended return exactly the right bytes", async () => {
    const total = Math.round(2.5 * MB);
    const file = randomBytes(total);
    const serve = (header: string) => {
      const r = parseRange(header, total)!;
      const { first, last, offset } = rangeToChunks(r.start, r.end, MB);
      const joined = file.subarray(first * MB, Math.min(total, (last + 1) * MB));
      return { ...r, bytes: joined.subarray(offset, offset + (r.end - r.start + 1)) };
    };
    const cases: [string, number, number][] = [
      ["bytes=0-99", 0, 99],
      ["bytes=1048570-1048590", 1048570, 1048590],
      ["bytes=-100", total - 100, total - 1],
      ["bytes=500000-", 500000, Math.min(total - 1, 500000 + 2 * MB - 1)],
    ];
    for (const [h, start, end] of cases) {
      const r = serve(h);
      expect([r.start, r.end]).toEqual([start, end]);
      expect(r.bytes.length).toBe(end - start + 1);
      expect(r.bytes.every((b, i) => b === file[start + i])).toBe(true);
    }
    expect(rangeToChunks(1048570, 1048590, MB)).toEqual({ first: 0, last: 1, offset: 1048570 });
    expect(parseRange(`bytes=${total}-`, total)).toBeNull();
  });

  it("7: with chunks 0–4 done, only chunk 5 onwards is requested", () => {
    expect(missingChunks(new Set([0, 1, 2, 3, 4]), 9)).toEqual([5, 6, 7, 8]);
    expect(missingChunks(new Set([0, 2]), 4)).toEqual([1, 3]);
  });

  it("8: reconciliation queues account-only songs, keeps current ones and removes songs deleted elsewhere", () => {
    const now = NOW;
    const local = [
      { songId: "kept", addedAt: now - 10 * DAY_MS, source: "user" },
      { songId: "deleted-elsewhere", addedAt: now - DAY_MS, source: "user" },
      { songId: "saved-again-here", addedAt: now - 1000, source: "user" },
      { songId: "just-saved", addedAt: now - 5000, source: "user" },
      { songId: "old-copy", addedAt: now - 30 * DAY_MS, source: "legacy" },
    ];
    const removedAt = new Map([["deleted-elsewhere", now - 60000], ["saved-again-here", now - 5000]]);
    const r = reconcile(["kept", "on-account-only"], local, removedAt, now);
    expect(r.remove).toEqual(["deleted-elsewhere"]);
    expect(r.queue).toEqual(["on-account-only"]);
    expect(r.keep.sort()).toEqual(["just-saved", "kept", "old-copy", "saved-again-here"]);
  });
});
