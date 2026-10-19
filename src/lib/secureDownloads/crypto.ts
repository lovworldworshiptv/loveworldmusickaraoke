/**
 * Device-side crypto for encrypted offline downloads.
 * - The device private key is generated non-extractable and never leaves the browser.
 * - Content keys arrive wrapped for this device and are unwrapped straight into
 *   non-extractable CryptoKeys, so raw key bytes are never visible to app code.
 */
import type { WrappedLicence } from "./types";

export const GCM_TAG_BYTES = 16;
const enc = new TextEncoder();
const bytes = (s: string) => new Uint8Array(enc.encode(s));

export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

/** 96-bit IV: zero prefix + big-endian chunk index (each package has its own random key). */
export const chunkIv = (index: number) => {
  const iv = new Uint8Array(12);
  new DataView(iv.buffer).setUint32(8, index);
  return iv;
};
export const chunkAad = (packageId: string, index: number) => bytes(`${packageId}:${index}`);

const publicJwk = (jwk: JsonWebKey): JsonWebKey => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });

export async function generateDeviceKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateKey: pair.privateKey, publicKeyJwk: publicJwk(jwk) };
}

export async function unwrapContentKey(privateKey: CryptoKey, packageId: string, lic: WrappedLicence): Promise<CryptoKey> {
  const eph = await crypto.subtle.importKey("jwk", publicJwk(lic.ephemeralPublicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: eph }, privateKey, 256);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const wrapKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: bytes("lmk-offline-licence-v1"), info: bytes(lic.licenceId) },
    base, { name: "AES-GCM", length: 256 }, false, ["unwrapKey"],
  );
  return crypto.subtle.unwrapKey(
    "raw", fromB64(lic.wrappedKey), wrapKey,
    { name: "AES-GCM", iv: fromB64(lic.iv), additionalData: bytes(packageId) },
    { name: "AES-GCM" }, false, ["decrypt"],
  );
}

export const decryptChunk = (key: CryptoKey, packageId: string, index: number, data: ArrayBuffer) =>
  crypto.subtle.decrypt({ name: "AES-GCM", iv: chunkIv(index), additionalData: chunkAad(packageId, index) }, key, data);
