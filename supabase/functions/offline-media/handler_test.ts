// Run: deno test --allow-net --allow-env --no-check supabase/functions/offline-media/handler_test.ts
// Uses an in-memory fake of the backend so every rule can be checked without real data.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { CHUNK_SIZE, createHandler, LICENCE_SALT } from "./handler.ts";

// ---------------- in-memory backend fake ----------------
type Row = Record<string, any>;
const nowIso = () => new Date().toISOString();
const DEFAULTS: Record<string, () => Row> = {
  offline_devices: () => ({ id: crypto.randomUUID(), created_at: nowIso(), last_active_at: nowIso(), revoked_at: null }),
  offline_licences: () => ({ id: crypto.randomUUID(), issued_at: nowIso(), revoked_at: null }),
  offline_licence_requests: () => ({ id: crypto.randomUUID(), created_at: nowIso() }),
  offline_packages: () => ({ id: crypto.randomUUID(), status: "preparing", chunk_size: CHUNK_SIZE, chunk_count: null, byte_length: null, mime_type: null, error: null, attempts: 0, created_at: nowIso(), updated_at: nowIso() }),
  offline_package_keys: () => ({ created_at: nowIso(), key_version: 1 }),
};
const PK: Record<string, string> = { offline_package_keys: "package_id" };

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: any = null;
  private countMode = false;
  private returning = false;
  constructor(private db: Record<string, Row[]>, private table: string) {}
  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.countMode = !!opts?.count; else this.returning = true;
    return this;
  }
  insert(p: any) { this.op = "insert"; this.payload = p; return this; }
  update(p: any) { this.op = "update"; this.payload = p; return this; }
  upsert(p: any) { this.op = "upsert"; this.payload = p; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  gt(c: string, v: any) { this.filters.push((r) => r[c] > v); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] >= v); return this; }
  order() { return this; }
  limit() { return this; }
  maybeSingle() { return this.run().then((r) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data })); }
  single() { return this.maybeSingle(); }
  then(res: any, rej: any) { return this.run().then(res, rej); }
  private rows() { return (this.db[this.table] ||= []); }
  private match() { return this.rows().filter((r) => this.filters.every((f) => f(r))); }
  private async run(): Promise<{ data: any; error: any; count?: number }> {
    if (this.op === "select") {
      const m = this.match();
      return this.countMode ? { data: null, error: null, count: m.length } : { data: m.map((r) => ({ ...r })), error: null };
    }
    const list = Array.isArray(this.payload) ? this.payload : [this.payload];
    if (this.op === "insert" || this.op === "upsert") {
      const out: Row[] = [];
      for (const p of list) {
        const key = PK[this.table] || "id";
        const existing = this.op === "upsert" && p[key] ? this.rows().find((r) => r[key] === p[key]) : null;
        if (existing) { Object.assign(existing, p); out.push({ ...existing }); continue; }
        const row = { ...(DEFAULTS[this.table]?.() || { id: crypto.randomUUID() }), ...p };
        this.rows().push(row); out.push({ ...row });
      }
      return { data: this.returning ? out : null, error: null };
    }
    const m = this.match();
    for (const r of m) Object.assign(r, this.payload, this.table === "offline_packages" ? { updated_at: nowIso() } : {});
    return { data: null, error: null };
  }
}

function fakeBackend() {
  const db: Record<string, Row[]> = {};
  const files = new Map<string, Uint8Array>();
  const tokens = new Map<string, { id: string }>();
  const svc = {
    db, files, tokens,
    from: (t: string) => new Query(db, t),
    auth: { getUser: async (tok: string) => ({ data: { user: tokens.get(tok) ?? null } }) },
    storage: {
      from: () => ({
        upload: async (path: string, blob: Blob) => { files.set(path, new Uint8Array(await blob.arrayBuffer())); return { error: null }; },
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ signedUrl: `fake://${p}` })), error: null }),
      }),
    },
  };
  return svc;
}

// ---------------- device-side helpers (mirror of the client) ----------------
const enc = new TextEncoder();
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function newDevice() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]) as CryptoKeyPair;
  const { kty, crv, x, y } = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateKey: pair.privateKey, jwk: { kty, crv, x, y } };
}
async function unwrap(privateKey: CryptoKey, lic: any) {
  const eph = await crypto.subtle.importKey("jwk", lic.ephemeralPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: eph }, privateKey, 256);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const kek = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode(LICENCE_SALT), info: enc.encode(lic.licenceId) }, base, { name: "AES-KW", length: 256 }, false, ["unwrapKey"]);
  return crypto.subtle.unwrapKey("raw", fromB64(lic.wrappedKey), kek, "AES-KW", { name: "AES-GCM" }, false, ["decrypt"]);
}
const iv = (i: number) => { const v = new Uint8Array(12); new DataView(v.buffer).setUint32(8, i); return v; };

// ---------------- fixtures ----------------
const USER_A = { id: crypto.randomUUID() };
const USER_B = { id: crypto.randomUUID() };
const FREE_SONG = crypto.randomUUID();
const PAID_SONG = crypto.randomUUID();
const SOURCE = (() => {
  const u = new Uint8Array(Math.round(2.5 * CHUNK_SIZE));
  for (let i = 0; i < u.length; i += 65536) crypto.getRandomValues(u.subarray(i, i + 65536));
  return u;
})();

function setup() {
  const svc = fakeBackend();
  svc.tokens.set("tok-a", USER_A); svc.tokens.set("tok-b", USER_B);
  svc.db.songs = [
    { id: FREE_SONG, is_free_download: true, audio_url: "https://media.test/free.mp3", instrumental_url: null, original_language: "en" },
    { id: PAID_SONG, is_free_download: false, audio_url: "https://media.test/paid.mp3", instrumental_url: null, original_language: "en" },
  ];
  svc.db.user_subscriptions = [{ user_id: USER_A.id, subscription: "free", subscription_expiry_date: null }];
  svc.db.song_videos = [];
  const handler = createHandler({
    svc,
    env: (n) => (n === "OFFLINE_MASTER_KEY" ? "test-master-secret-value-0123456789" : undefined),
    fetch: (async () => new Response(SOURCE, { headers: { "content-type": "audio/mpeg" } })) as typeof fetch,
  });
  const call = async (token: string | null, body: unknown) => {
    const res = await handler(new Request("http://x/offline-media", {
      method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }));
    return { status: res.status, body: await res.json() };
  };
  return { svc, call };
}

async function registered(call: any, token = "tok-a") {
  const dev = await newDevice();
  const r = await call(token, { action: "register_device", publicKeyJwk: dev.jwk, label: "Test" });
  assertEquals(r.status, 200);
  return { ...dev, id: r.body.device.id as string };
}

async function readyPackage(call: any, songId = FREE_SONG) {
  // First call builds the package; the next call (as the app's polling does) sees it ready.
  assertEquals((await call("tok-a", { action: "prepare", songId })).status, 200);
  const r = await call("tok-a", { action: "prepare", songId });
  assertEquals(r.status, 200);
  const pkg = r.body.packages.find((p: any) => p.kind === "audio");
  assertEquals(pkg.status, "ready");
  return pkg.id as string;
}

// ---------------- tests ----------------
Deno.test("no sign-in → 401", async () => {
  const { call } = setup();
  assertEquals((await call(null, { action: "devices" })).status, 401);
  assertEquals((await call("bogus", { action: "devices" })).status, 401);
});

Deno.test("sixth active device is refused with device_limit", async () => {
  const { call } = setup();
  for (let i = 0; i < 5; i++) await registered(call);
  const dev = await newDevice();
  const r = await call("tok-a", { action: "register_device", publicKeyJwk: dev.jwk });
  assertEquals(r.status, 409);
  assertEquals(r.body.error, "device_limit");
  assertEquals(r.body.limit, 5);
});

Deno.test("private key material is refused at registration", async () => {
  const { call } = setup();
  const dev = await newDevice();
  const r = await call("tok-a", { action: "register_device", publicKeyJwk: { ...dev.jwk, d: "secret-part-xxxxxxxx" } });
  assertEquals(r.status, 400);
});

Deno.test("licence happy path → 200, AES-KW wrapped key decrypts every chunk byte-for-byte", async () => {
  const { call, svc } = setup();
  const dev = await registered(call);
  const pkgId = await readyPackage(call);
  const r = await call("tok-a", { action: "licence", deviceId: dev.id, packageIds: [pkgId] });
  assertEquals(r.status, 200);
  const lic = r.body.licences[0];
  assertEquals(lic.alg, "A256KW");
  // Free song → licence runs the full 30 days.
  assert(Math.abs(Date.parse(lic.expiresAt) - (Date.now() + 30 * 86400000)) < 60000, "expiresAt should be 30 days ahead");
  assertEquals(lic.manifest.chunkCount, 3);
  const key = await unwrap(dev.privateKey, lic);
  const urls = await call("tok-a", { action: "chunk_urls", deviceId: dev.id, packageId: pkgId, from: 0, count: 32 });
  assertEquals(urls.status, 200);
  assertEquals(urls.body.urls.length, 3);
  const out = new Uint8Array(SOURCE.length);
  let off = 0;
  for (const u of urls.body.urls) {
    const ct = svc.files.get(String(u.url).replace("fake://", ""))!;
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv(u.index), additionalData: enc.encode(`${pkgId}:${u.index}`) }, key, ct));
    out.set(pt, off); off += pt.length;
  }
  assertEquals(off, SOURCE.length);
  assert(out.every((b, i) => b === SOURCE[i]));
});

Deno.test("another device's private key cannot open the licence", async () => {
  const { call } = setup();
  const dev = await registered(call);
  const other = await newDevice();
  const pkgId = await readyPackage(call);
  const r = await call("tok-a", { action: "licence", deviceId: dev.id, packageIds: [pkgId] });
  let failed = false;
  try { await unwrap(other.privateKey, r.body.licences[0]); } catch { failed = true; }
  assert(failed);
});

Deno.test("revoked device → 403 device_revoked", async () => {
  const { call } = setup();
  const dev = await registered(call);
  const pkgId = await readyPackage(call);
  await call("tok-a", { action: "revoke_device", deviceId: dev.id });
  const r = await call("tok-a", { action: "licence", deviceId: dev.id, packageIds: [pkgId] });
  assertEquals(r.status, 403);
  assertEquals(r.body.error, "device_revoked");
});

Deno.test("someone else's device → 403 device_not_owned", async () => {
  const { call } = setup();
  const devB = await registered(call, "tok-b");
  const pkgId = await readyPackage(call);
  const r = await call("tok-a", { action: "licence", deviceId: devB.id, packageIds: [pkgId] });
  assertEquals(r.status, 403);
  assertEquals(r.body.error, "device_not_owned");
});

Deno.test("song not covered by the plan → 403 not_entitled", async () => {
  const { call, svc } = setup();
  const dev = await registered(call);
  // Package the paid song while the user is premium, then the plan lapses.
  svc.db.user_subscriptions[0] = { user_id: USER_A.id, subscription: "premium", subscription_expiry_date: null };
  const pkgId = await readyPackage(call, PAID_SONG);
  svc.db.user_subscriptions[0] = { user_id: USER_A.id, subscription: "free", subscription_expiry_date: null };
  const r = await call("tok-a", { action: "licence", deviceId: dev.id, packageIds: [pkgId] });
  assertEquals(r.status, 403);
  assertEquals(r.body.error, "not_entitled");
  const p = await call("tok-a", { action: "prepare", songId: PAID_SONG });
  assertEquals(p.status, 403);
});

Deno.test("licence expiry is capped at the subscription end date", async () => {
  const { call, svc } = setup();
  const dev = await registered(call);
  const end = new Date(Date.now() + 5 * 86400000).toISOString();
  svc.db.user_subscriptions[0] = { user_id: USER_A.id, subscription: "premium", subscription_expiry_date: end };
  const pkgId = await readyPackage(call, PAID_SONG);
  const r = await call("tok-a", { action: "licence", deviceId: dev.id, packageIds: [pkgId] });
  assertEquals(r.status, 200);
  assertEquals(r.body.licences[0].expiresAt, end);
});

Deno.test("61st licence request within an hour → 429", async () => {
  const { call } = setup();
  const dev = await registered(call);
  const pkgId = await readyPackage(call);
  for (let i = 0; i < 60; i++) {
    const r = await call("tok-a", { action: "licence", deviceId: dev.id, packageIds: [pkgId] });
    assertEquals(r.status, 200, `request ${i + 1}`);
  }
  const r = await call("tok-a", { action: "licence", deviceId: dev.id, packageIds: [pkgId] });
  assertEquals(r.status, 429);
  assertEquals(r.body.error, "rate_limited");
});

Deno.test("chunk links need a live licence for that device", async () => {
  const { call } = setup();
  const dev = await registered(call);
  const pkgId = await readyPackage(call);
  const r = await call("tok-a", { action: "chunk_urls", deviceId: dev.id, packageId: pkgId, from: 0, count: 4 });
  assertEquals(r.status, 403);
  assertEquals(r.body.error, "no_licence");
});

Deno.test("stored chunks are ciphertext, never the original bytes", async () => {
  const { call, svc } = setup();
  const pkgId = await readyPackage(call);
  const first = svc.files.get(`${pkgId}/0.bin`)!;
  assertEquals(first.length, CHUNK_SIZE + 16);
  let same = 0;
  for (let i = 0; i < 4096; i++) if (first[i] === SOURCE[i]) same++;
  assert(same < 100, "chunk looks like plaintext");
  // Content keys are stored only wrapped with the master key, tagged with its version.
  const k = svc.db.offline_package_keys[0];
  assertEquals(k.key_version, 1);
  assert(!("raw" in k));
});
