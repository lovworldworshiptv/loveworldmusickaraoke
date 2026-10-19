// Secure offline downloads: encrypted packaging, device registration and
// device-bound playback licences. Content keys never leave this function in
// usable form — they are wrapped per device (ECDH P-256 + HKDF-SHA256 + AES-KW).
//
// Honest scope: this stops ordinary copying and sharing of stored files, but it
// is not studio-grade (hardware) DRM. A DRM provider (Widevine/FairPlay) could
// replace the licence step later without changing the app's screens.
//
// The handler takes its backend client as a dependency so it can be tested
// with an in-memory fake (see handler_test.ts).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

export const CHUNK_SIZE = 1024 * 1024;
export const MAX_DEVICES = 5;
export const LICENCE_DAYS = 30;
export const LICENCE_REQUESTS_PER_HOUR = 60;
const BUCKET = "offline-packages";
const STALE_PREPARE_MS = 6 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const VIDEO_ORDER = ["official", "lyric", "live", "karaoke"];
export const LICENCE_ALG = "A256KW";
export const LICENCE_SALT = "lmk-offline-licence-v2";

// deno-lint-ignore no-explicit-any
type Svc = any;
export interface Deps {
  svc: Svc;
  env: (name: string) => string | undefined;
  fetch?: typeof fetch;
  waitUntil?: (p: Promise<unknown>) => void;
  now?: () => number;
}

const enc = new TextEncoder();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** 96-bit IV: zero prefix + big-endian chunk index (each package has its own random key, so IVs never repeat). */
export const chunkIv = (index: number) => {
  const iv = new Uint8Array(12);
  new DataView(iv.buffer).setUint32(8, index);
  return iv;
};
/** Package id + chunk index are authenticated, so chunks cannot be reordered or swapped between packages. */
export const chunkAad = (packageId: string, index: number) => enc.encode(`${packageId}:${index}`);

async function sha256Hex(text: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createHandler(deps: Deps) {
  const { svc, env } = deps;
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? (() => Date.now());

  // ---------- master keys (rotation via key_version) ----------
  const masterKeys = new Map<number, Promise<CryptoKey>>();
  const currentKeyVersion = () => Number(env("OFFLINE_MASTER_KEY_VERSION") || 1);
  function masterKey(version: number) {
    if (!masterKeys.has(version)) {
      masterKeys.set(version, (async () => {
        const secret = env(version === 1 ? "OFFLINE_MASTER_KEY" : `OFFLINE_MASTER_KEY_V${version}`);
        if (!secret) throw new Error("Offline key not configured");
        const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
        return crypto.subtle.deriveKey(
          { name: "HKDF", hash: "SHA-256", salt: enc.encode("lmk-offline-master-v1"), info: enc.encode("content-key-wrap") },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
        );
      })());
    }
    return masterKeys.get(version)!;
  }

  // ---------- entitlement ----------
  async function entitlement(userId: string, songIds: string[]) {
    const [{ data: songs }, { data: sub }] = await Promise.all([
      svc.from("songs").select("id, is_free_download").in("id", songIds),
      svc.from("user_subscriptions").select("subscription, subscription_expiry_date").eq("user_id", userId).maybeSingle(),
    ]);
    const t = now();
    const cap = t + LICENCE_DAYS * 86400000;
    const subExpiry = sub?.subscription_expiry_date ? new Date(sub.subscription_expiry_date).getTime() : null;
    const premium = !!sub && ["premium", "trial"].includes(sub.subscription) && (subExpiry === null || subExpiry > t);
    const result = new Map<string, number | null>();
    for (const id of songIds) {
      // deno-lint-ignore no-explicit-any
      const song = (songs || []).find((s: any) => s.id === id);
      if (!song) result.set(id, null);
      else if (song.is_free_download) result.set(id, cap);
      else if (premium) result.set(id, Math.min(cap, subExpiry ?? cap));
      else result.set(id, null);
    }
    return result;
  }

  // ---------- packaging ----------
  type Source = { kind: "audio" | "instrumental" | "video"; url: string; language: string; meta?: Record<string, unknown> };

  async function resolveSources(songId: string, language?: string) {
    const { data: song } = await svc.from("songs").select("audio_url, instrumental_url, original_language").eq("id", songId).maybeSingle();
    if (!song) return { sources: [] as Source[], lyrics: null };
    const sources: Source[] = [];
    let lyrics: { lrc: string | null; text: string | null; language: string } | null = null;
    let audioUrl = song.audio_url as string | null;
    let audioLang = "";
    if (language && language !== song.original_language) {
      const [{ data: v }, { data: l }] = await Promise.all([
        svc.from("song_audio_versions").select("audio_url").eq("song_id", songId).eq("kind", "full")
          .eq("status", "ready").eq("language_code", language).maybeSingle(),
        svc.from("song_lyrics").select("lyrics_lrc, lyrics_text").eq("song_id", songId).eq("language_code", language).maybeSingle(),
      ]);
      if (v?.audio_url) { audioUrl = v.audio_url; audioLang = language; }
      if (l && (l.lyrics_lrc || l.lyrics_text)) lyrics = { lrc: l.lyrics_lrc, text: l.lyrics_text, language };
    }
    if (audioUrl) sources.push({ kind: "audio", url: audioUrl, language: audioLang });
    if (song.instrumental_url) sources.push({ kind: "instrumental", url: song.instrumental_url, language: "" });
    const { data: vids } = await svc.from("song_videos")
      .select("id, video_url, video_type, language_code, offset_ms, thumbnail_url").eq("song_id", songId).eq("is_active", true);
    // deno-lint-ignore no-explicit-any
    const video = (vids || []).filter((v: any) => !/youtu\.?be/.test(v.video_url))
      // deno-lint-ignore no-explicit-any
      .sort((a: any, b: any) => VIDEO_ORDER.indexOf(a.video_type) - VIDEO_ORDER.indexOf(b.video_type))[0];
    if (video) {
      sources.push({
        kind: "video", url: video.video_url, language: video.language_code || "",
        meta: { id: video.id, video_type: video.video_type, language_code: video.language_code, offset_ms: video.offset_ms, thumbnail_url: video.thumbnail_url },
      });
    }
    return { sources, lyrics };
  }

  async function buildPackage(pkgId: string, kind: string, url: string) {
    try {
      const resp = await doFetch(url);
      if (!resp.ok || !resp.body) throw new Error(`Source unavailable (${resp.status})`);
      const mime = resp.headers.get("content-type") || (kind === "video" ? "video/mp4" : "audio/mpeg");
      // 256-bit content key from the platform CSPRNG.
      const raw = crypto.getRandomValues(new Uint8Array(32));
      const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);

      const reader = resp.body.getReader();
      let buf = new Uint8Array(CHUNK_SIZE);
      let fill = 0;
      let index = 0;
      let total = 0;
      let inflight: Promise<void>[] = [];

      const flush = async (bytes: Uint8Array) => {
        const i = index++;
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: chunkIv(i), additionalData: chunkAad(pkgId, i) }, key, bytes);
        inflight.push((async () => {
          const { error } = await svc.storage.from(BUCKET).upload(`${pkgId}/${i}.bin`, new Blob([ct]), {
            contentType: "application/octet-stream", upsert: true,
          });
          if (error) throw new Error(`Chunk ${i} upload failed: ${error.message}`);
        })());
        if (inflight.length >= 4) { await Promise.all(inflight); inflight = []; }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        let off = 0;
        while (off < value.length) {
          const take = Math.min(CHUNK_SIZE - fill, value.length - off);
          buf.set(value.subarray(off, off + take), fill);
          fill += take; off += take; total += take;
          if (fill === CHUNK_SIZE) { await flush(buf); buf = new Uint8Array(CHUNK_SIZE); fill = 0; }
        }
      }
      if (fill > 0) await flush(buf.slice(0, fill));
      await Promise.all(inflight);
      if (total === 0) throw new Error("Source is empty");

      const version = currentKeyVersion();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(pkgId) }, await masterKey(version), raw);
      raw.fill(0);
      const { error: keyErr } = await svc.from("offline_package_keys")
        .upsert({ package_id: pkgId, wrapped_key: toB64(wrapped), iv: toB64(iv), key_version: version });
      if (keyErr) throw new Error(keyErr.message);
      await svc.from("offline_packages").update({
        status: "ready", chunk_count: index, byte_length: total, mime_type: mime, chunk_size: CHUNK_SIZE, error: null,
      }).eq("id", pkgId);
    } catch (e) {
      await svc.from("offline_packages").update({ status: "failed", error: String((e as Error).message).slice(0, 300) }).eq("id", pkgId);
    }
  }

  async function ensurePackage(songId: string, src: Source) {
    const hash = await sha256Hex(src.url);
    const sel = "id, song_id, kind, language_code, status, chunk_size, chunk_count, byte_length, mime_type, attempts, updated_at, error";
    let { data: pkg } = await svc.from("offline_packages").select(sel)
      .eq("song_id", songId).eq("kind", src.kind).eq("language_code", src.language).eq("source_hash", hash).maybeSingle();
    let start = false;
    if (!pkg) {
      const { data: inserted } = await svc.from("offline_packages")
        .insert({ song_id: songId, kind: src.kind, language_code: src.language, source_hash: hash, attempts: 1 })
        .select(sel).maybeSingle();
      if (inserted) { pkg = inserted; start = true; }
      else {
        ({ data: pkg } = await svc.from("offline_packages").select(sel)
          .eq("song_id", songId).eq("kind", src.kind).eq("language_code", src.language).eq("source_hash", hash).maybeSingle());
      }
    } else if (pkg.status !== "ready" && pkg.attempts < MAX_ATTEMPTS) {
      const stale = pkg.status === "preparing" && now() - new Date(pkg.updated_at).getTime() > STALE_PREPARE_MS;
      if (pkg.status === "failed" || stale) {
        await svc.from("offline_packages").update({ status: "preparing", attempts: pkg.attempts + 1, error: null }).eq("id", pkg.id);
        pkg = { ...pkg, status: "preparing" };
        start = true;
      }
    }
    if (!pkg) throw new Error("Could not prepare download");
    if (start) {
      const job = buildPackage(pkg.id, src.kind, src.url);
      if (deps.waitUntil) deps.waitUntil(job); else await job;
    }
    return { ...pkg, meta: src.meta ?? null };
  }

  // ---------- licences ----------
  /** Re-wrap the content key for one device: ECDH(fresh server key, device key) → HKDF-SHA256 → AES-KW. */
  async function wrapForDevice(devicePub: CryptoKey, rawKey: ArrayBuffer, licenceId: string) {
    const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: devicePub }, eph.privateKey, 256);
    const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
    const kek = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: enc.encode(LICENCE_SALT), info: enc.encode(licenceId) },
      base, { name: "AES-KW", length: 256 }, false, ["wrapKey"],
    );
    const content = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, true, ["decrypt"]);
    const wrapped = await crypto.subtle.wrapKey("raw", content, kek, "AES-KW");
    const ephemeralPublicKey = await crypto.subtle.exportKey("jwk", eph.publicKey);
    return { alg: LICENCE_ALG, ephemeralPublicKey, serverPublicKey: ephemeralPublicKey, iv: "", wrappedKey: toB64(wrapped) };
  }

  // ---------- request schemas ----------
  const Jwk = z.object({ kty: z.literal("EC"), crv: z.literal("P-256"), x: z.string().min(10), y: z.string().min(10) }).passthrough();
  const Body = z.discriminatedUnion("action", [
    z.object({ action: z.literal("register_device"), publicKeyJwk: Jwk, label: z.string().max(80).optional(), userAgent: z.string().max(400).optional() }),
    z.object({ action: z.literal("devices") }),
    z.object({ action: z.literal("touch_device"), deviceId: z.string().uuid() }),
    z.object({ action: z.literal("revoke_device"), deviceId: z.string().uuid() }),
    z.object({ action: z.literal("prepare"), songId: z.string().uuid(), language: z.string().max(12).optional() }),
    z.object({ action: z.literal("licence"), deviceId: z.string().uuid(), packageIds: z.array(z.string().uuid()).min(1).max(60) }),
    z.object({ action: z.literal("chunk_urls"), deviceId: z.string().uuid(), packageId: z.string().uuid(), from: z.number().int().min(0), count: z.number().int().min(1).max(32) }),
  ]);

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      // 1. Signed-in user (JWT)
      const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "Not signed in" }, 401);
      const { data: { user } } = await svc.auth.getUser(token);
      if (!user) return json({ error: "Not signed in" }, 401);

      const parsed = Body.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
      const body = parsed.data;

      /** 2. device belongs to this user, 3. not revoked. */
      const checkDevice = async (deviceId: string) => {
        const { data } = await svc.from("offline_devices").select("id, user_id, public_key_jwk, revoked_at").eq("id", deviceId).maybeSingle();
        if (!data || data.user_id !== user.id) return { error: json({ error: "device_not_owned" }, 403) };
        if (data.revoked_at) return { error: json({ error: "device_revoked" }, 403) };
        return { device: data as { id: string; public_key_jwk: JsonWebKey } };
      };
      const listDevices = async () => {
        const { data } = await svc.from("offline_devices").select("id, label, user_agent, created_at, last_active_at")
          .eq("user_id", user.id).is("revoked_at", null).order("last_active_at", { ascending: false });
        return data || [];
      };

      switch (body.action) {
        case "register_device": {
          if ("d" in body.publicKeyJwk) return json({ error: "Only a public key may be registered" }, 400);
          const devices = await listDevices();
          if (devices.length >= MAX_DEVICES) return json({ error: "device_limit", limit: MAX_DEVICES, devices }, 409);
          const { kty, crv, x, y } = body.publicKeyJwk;
          const { data, error } = await svc.from("offline_devices").insert({
            user_id: user.id, label: body.label || "This device", user_agent: body.userAgent || null,
            public_key_jwk: { kty, crv, x, y },
          }).select("id, label, created_at, last_active_at").single();
          if (error) throw error;
          return json({ device: data });
        }
        case "devices":
          return json({ devices: await listDevices(), limit: MAX_DEVICES });
        case "touch_device": {
          const { device } = await checkDevice(body.deviceId);
          if (device) await svc.from("offline_devices").update({ last_active_at: new Date(now()).toISOString() }).eq("id", device.id);
          return json({ active: !!device });
        }
        case "revoke_device": {
          const t = new Date(now()).toISOString();
          await svc.from("offline_devices").update({ revoked_at: t }).eq("id", body.deviceId).eq("user_id", user.id);
          await svc.from("offline_licences").update({ revoked_at: t }).eq("device_id", body.deviceId).eq("user_id", user.id).is("revoked_at", null);
          return json({ ok: true, devices: await listDevices() });
        }
        case "prepare": {
          const ent = await entitlement(user.id, [body.songId]);
          if (!ent.get(body.songId)) return json({ error: "not_entitled" }, 403);
          const { sources, lyrics } = await resolveSources(body.songId, body.language);
          if (!sources.some((s) => s.kind === "audio")) return json({ error: "No audio available for this song" }, 404);
          const packages = [];
          for (const src of sources) packages.push(await ensurePackage(body.songId, src));
          return json({
            // deno-lint-ignore no-explicit-any
            packages: packages.map((p: any) => ({
              id: p.id, kind: p.kind, language: p.language_code, status: p.status, chunkSize: p.chunk_size,
              chunkCount: p.chunk_count, byteLength: p.byte_length, mimeType: p.mime_type, error: p.error, meta: p.meta,
            })),
            lyrics,
          });
        }
        case "licence": {
          const { device, error: deviceError } = await checkDevice(body.deviceId);
          if (deviceError) return deviceError;
          // Rate limit: at most 60 licence requests per user per hour.
          const since = new Date(now() - 3600000).toISOString();
          const { count } = await svc.from("offline_licence_requests").select("id", { count: "exact", head: true })
            .eq("user_id", user.id).gte("created_at", since);
          if ((count ?? 0) >= LICENCE_REQUESTS_PER_HOUR) return json({ error: "rate_limited", retryAfterSeconds: 600 }, 429);
          await svc.from("offline_licence_requests").insert({ user_id: user.id, created_at: new Date(now()).toISOString() });

          const { data: pkgs } = await svc.from("offline_packages")
            .select("id, song_id, kind, status, chunk_size, chunk_count, byte_length, mime_type").in("id", body.packageIds).eq("status", "ready");
          // deno-lint-ignore no-explicit-any
          const ready = (pkgs || []) as any[];
          // 4. entitlement
          const ent = await entitlement(user.id, [...new Set(ready.map((p) => p.song_id as string))]);
          const { data: keys } = await svc.from("offline_package_keys").select("package_id, wrapped_key, iv, key_version").in("package_id", ready.map((p) => p.id));
          const devicePub = await crypto.subtle.importKey("jwk", device!.public_key_jwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
          const licences = [];
          const denied: string[] = [];
          const notEntitled: string[] = [];
          const rows = [];
          for (const p of ready) {
            const expiresAt = ent.get(p.song_id);
            // deno-lint-ignore no-explicit-any
            const k = (keys || []).find((r: any) => r.package_id === p.id);
            if (!expiresAt) { denied.push(p.id); notEntitled.push(p.id); continue; }
            if (!k) { denied.push(p.id); continue; }
            const mk = await masterKey(Number(k.key_version || 1));
            const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(k.iv), additionalData: enc.encode(p.id) }, mk, fromB64(k.wrapped_key));
            const licenceId = crypto.randomUUID();
            const wrapped = await wrapForDevice(devicePub, raw, licenceId);
            new Uint8Array(raw).fill(0);
            const exp = new Date(expiresAt).toISOString();
            rows.push({ id: licenceId, user_id: user.id, device_id: device!.id, package_id: p.id, expires_at: exp });
            licences.push({
              packageId: p.id, licenceId, expiresAt: exp, ...wrapped,
              manifest: { kind: p.kind, chunkSize: p.chunk_size, chunkCount: p.chunk_count, byteLength: p.byte_length, mimeType: p.mime_type },
            });
          }
          for (const id of body.packageIds) if (!ready.some((p) => p.id === id)) denied.push(id);
          if (rows.length) await svc.from("offline_licences").insert(rows);
          await svc.from("offline_devices").update({ last_active_at: new Date(now()).toISOString() }).eq("id", device!.id);
          if (!licences.length && notEntitled.length) return json({ error: "not_entitled", denied }, 403);
          return json({ licences, denied });
        }
        case "chunk_urls": {
          const { device, error: deviceError } = await checkDevice(body.deviceId);
          if (deviceError) return deviceError;
          const { data: lic } = await svc.from("offline_licences").select("id")
            .eq("user_id", user.id).eq("device_id", device!.id).eq("package_id", body.packageId)
            .is("revoked_at", null).gt("expires_at", new Date(now()).toISOString()).limit(1).maybeSingle();
          if (!lic) return json({ error: "no_licence" }, 403);
          const { data: pkg } = await svc.from("offline_packages").select("chunk_count").eq("id", body.packageId).maybeSingle();
          const last = Math.min((pkg?.chunk_count ?? 0), body.from + body.count);
          const paths = [];
          for (let i = body.from; i < last; i++) paths.push(`${body.packageId}/${i}.bin`);
          if (!paths.length) return json({ urls: [] });
          const { data, error } = await svc.storage.from(BUCKET).createSignedUrls(paths, 300);
          if (error) throw error;
          // deno-lint-ignore no-explicit-any
          return json({ urls: (data || []).map((d: any, i: number) => ({ index: body.from + i, url: d.signedUrl })) });
        }
      }
      return json({ error: "Unknown action" }, 400);
    } catch (e) {
      // Only the message is logged — never keys, wrapped keys, IVs or media bytes.
      console.error("offline-media error:", (e as Error)?.message || "unknown");
      return json({ error: "Server error" }, 500);
    }
  };
}
