// @vitest-environment node
import { describe, it, expect } from "vitest";
import { generateDeviceKeys, unwrapContentKey, decryptChunk, chunkIv, chunkAad, toB64 } from "./crypto";
import {
  needsRenewal, isLicenceValid, sortQueue, isMeteredConnection, isKnownUnmetered, hasRoomFor,
  plainChunkLength, rangeToChunks, DAY_MS, SPACE_HEADROOM_BYTES,
} from "./policy";

const enc = new TextEncoder();
const NOW = Date.UTC(2026, 9, 19, 12);

/** Mirror of the backend's licence wrapping, to prove device-side unwrapping matches it. */
async function serverWrap(devicePub: JsonWebKey, raw: Uint8Array, packageId: string, licenceId: string) {
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
