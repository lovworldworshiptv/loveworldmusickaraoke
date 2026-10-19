// ---------------------------------------------------------------------------
// Cache versioning
// Bump CACHE_VERSION on any release that changes the app shell, the cached
// metadata shape, or the lyrics format. Every cache name is derived from it,
// so old caches are dropped automatically on activate.
// ---------------------------------------------------------------------------
const CACHE_VERSION = 'v8';
const CACHE_PREFIX = 'lmk';
const CACHE_NAME = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const METADATA_CACHE = `${CACHE_PREFIX}-metadata-${CACHE_VERSION}`;
// Hashed assets and images survive version bumps (their URLs change on update).
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images`;
const IMAGE_MAX_ENTRIES = 400;
const KNOWN_CACHES = [CACHE_NAME, METADATA_CACHE, ASSET_CACHE, IMAGE_CACHE];

const trimCache = async (name, max) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  }
};

// Cached metadata / lyrics older than this are considered stale and pruned.
const METADATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Hard cap on cached metadata responses (oldest evicted first).
const METADATA_MAX_ENTRIES = 300;
const CACHED_AT_HEADER = 'x-lmk-cached-at';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.png',
];

// Supabase REST tables whose GET responses are safe to cache for offline browsing.
// Metadata + lyrics only — never audio/media objects.
const CACHEABLE_TABLES = [
  'songs',
  'albums',
  'album_songs',
  'playlists',
  'playlist_songs',
  'categories',
  'song_categories',
  'articles',
];

const isCacheableMetadataRequest = (request, url) => {
  if (request.method !== 'GET') return false;
  if (!url.hostname.includes('supabase')) return false;
  if (!url.pathname.startsWith('/rest/v1/')) return false;
  const table = url.pathname.replace('/rest/v1/', '').split('/')[0];
  return CACHEABLE_TABLES.includes(table);
};

// Store a response with a timestamp header so it can be expired later.
const putMetadata = async (request, response) => {
  const body = await response.clone().blob();
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT_HEADER, String(Date.now()));
  const cache = await caches.open(METADATA_CACHE);
  await cache.put(
    request,
    new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  );
};

const cachedAt = (response) => {
  const raw = response && response.headers.get(CACHED_AT_HEADER);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : 0;
};

const isExpired = (response) => Date.now() - cachedAt(response) > METADATA_MAX_AGE_MS;

// Remove expired entries, then trim the oldest ones down to the size cap.
const pruneMetadataCache = async () => {
  const cache = await caches.open(METADATA_CACHE);
  const requests = await cache.keys();
  const entries = [];

  for (const request of requests) {
    const response = await cache.match(request);
    if (!response || isExpired(response)) {
      await cache.delete(request);
      continue;
    }
    entries.push({ request, time: cachedAt(response) });
  }

  if (entries.length > METADATA_MAX_ENTRIES) {
    entries.sort((a, b) => a.time - b.time);
    const overflow = entries.slice(0, entries.length - METADATA_MAX_ENTRIES);
    await Promise.all(overflow.map((entry) => cache.delete(entry.request)));
  }
};

// Delete every cache that does not belong to the current version.
const deleteOutdatedCaches = async () => {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !KNOWN_CACHES.includes(key))
      .map((key) => caches.delete(key))
  );
};

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

// Activate: drop outdated version caches, prune stale metadata/lyrics
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await deleteOutdatedCaches();
      await pruneMetadataCache().catch(() => undefined);
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) =>
        client.postMessage({ type: 'LMK_SW_ACTIVATED', version: CACHE_VERSION })
      );
    })()
  );
});

// Periodic pruning while the worker is alive (throttled to once an hour).
let lastPruneAt = 0;
const maybePrune = (event) => {
  const now = Date.now();
  if (now - lastPruneAt < 60 * 60 * 1000) return;
  lastPruneAt = now;
  event.waitUntil(pruneMetadataCache().catch(() => undefined));
};


// ---------------------------------------------------------------------------
// Secure offline stream: /offline-stream/<packageId>
// Serves encrypted downloads by decrypting only the 1 MB chunks a byte range
// needs. Keys stay non-extractable; nothing decrypted is cached or stored.
// ---------------------------------------------------------------------------
const SECURE_DB = 'lmk_secure_downloads';
const STREAM_PREFIX = '/offline-stream/';
// Friendly alias: /__offline/<songId>?kind=audio|instrumental|video (defaults to audio).
const MEDIA_PREFIX = '/__offline/';
const STREAM_MAX_SPAN = 2 * 1024 * 1024;
const streamKeys = new Map(); // packageId -> { licenceId, key }
const te = new TextEncoder();

const secureDb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(SECURE_DB);
  // Never create the database from here — the app owns its schema.
  req.onupgradeneeded = () => req.transaction.abort();
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const idbReq = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const idbGet = (db, store, key) => idbReq(db.transaction(store).objectStore(store).get(key));
const idbAll = (db, store) => idbReq(db.transaction(store).objectStore(store).getAll());
const chunkStoreKey = (id, i) => `${id}:${String(i).padStart(6, '0')}`;
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ivFor = (i) => { const iv = new Uint8Array(12); new DataView(iv.buffer).setUint32(8, i); return iv; };

async function streamKeyFor(db, pkg) {
  const cached = streamKeys.get(pkg.packageId);
  if (cached && cached.licenceId === pkg.licence.licenceId) return cached.key;
  const device = await idbGet(db, 'device', 'current');
  if (!device) throw new Error('no device');
  const l = pkg.licence;
  const e = l.ephemeralPublicKey;
  const eph = await crypto.subtle.importKey('jwk', { kty: e.kty, crv: e.crv, x: e.x, y: e.y }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: eph }, device.privateKey, 256);
  const base = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  let key;
  if (l.alg === 'A256KW') {
    const kek = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: te.encode('lmk-offline-licence-v2'), info: te.encode(l.licenceId) },
      base, { name: 'AES-KW', length: 256 }, false, ['unwrapKey']
    );
    key = await crypto.subtle.unwrapKey('raw', fromB64(l.wrappedKey), kek, 'AES-KW', { name: 'AES-GCM' }, false, ['decrypt']);
  } else {
    const wrapKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: te.encode('lmk-offline-licence-v1'), info: te.encode(l.licenceId) },
      base, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']
    );
    key = await crypto.subtle.unwrapKey('raw', fromB64(l.wrappedKey), wrapKey,
      { name: 'AES-GCM', iv: fromB64(l.iv), additionalData: te.encode(pkg.packageId) }, { name: 'AES-GCM' }, false, ['decrypt']);
  }
  streamKeys.set(pkg.packageId, { licenceId: l.licenceId, key });
  return key;
}

// Chunks live in OPFS (lmk-secure/<packageId>/<000000>) when pkg.storage === 'opfs', else in IndexedDB.
const OPFS_DIR = 'lmk-secure';
async function opfsChunk(pkg, i) {
  try {
    const root = await self.navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle(OPFS_DIR)).getDirectoryHandle(pkg.packageId);
    const file = await (await dir.getFileHandle(String(i).padStart(6, '0'))).getFile();
    return file.size ? await file.arrayBuffer() : null;
  } catch (_) { return null; }
}

async function decryptStreamChunk(db, key, pkg, i) {
  const data = pkg.storage === 'opfs' ? await opfsChunk(pkg, i) : await idbGet(db, 'chunks', chunkStoreKey(pkg.packageId, i));
  if (!data) throw new Error('missing chunk');
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivFor(i), additionalData: te.encode(`${pkg.packageId}:${i}`) }, key, data));
}

async function handleOfflineStream(request, packageId, bySong) {
  try {
    const db = await secureDb();
    const items = await idbAll(db, 'items');
    let pkg = null;
    for (const item of items) {
      if (item.status !== 'ready') continue;
      const p = bySong
        ? (item.songId === bySong.songId ? (item.packages || []).find((x) => x.kind === bySong.kind) : null)
        : (item.packages || []).find((x) => x.packageId === packageId);
      if (p) { pkg = p; break; }
    }
    if (!pkg) return new Response('Not found', { status: 404 });
    if (!pkg.licence || Date.parse(pkg.licence.expiresAt) < Date.now()) return new Response('Connect once to keep this available', { status: 403 });
    const key = await streamKeyFor(db, pkg);
    const total = pkg.byteLength;
    const cs = pkg.chunkSize;
    const headers = { 'Content-Type': pkg.mimeType || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    const range = request.headers.get('range');

    if (!range) {
      let i = 0;
      const body = new ReadableStream({
        async pull(controller) {
          if (i >= pkg.chunkCount) { controller.close(); return; }
          try { controller.enqueue(await decryptStreamChunk(db, key, pkg, i++)); } catch (e) { controller.error(e); }
        },
      });
      return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(total) } });
    }

    const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
    let start; let end;
    if (m[1] === '' || m[1] === undefined) { start = Math.max(0, total - Number(m[2] || 0)); end = total - 1; }
    else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1; }
    if (start >= total || start > end) {
      return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${total}` } });
    }
    end = Math.min(end, start + STREAM_MAX_SPAN - 1);
    const first = Math.floor(start / cs);
    const last = Math.floor(end / cs);
    const parts = [];
    for (let i = first; i <= last; i++) parts.push(await decryptStreamChunk(db, key, pkg, i));
    const joined = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of parts) { joined.set(p, o); o += p.length; }
    const offset = start - first * cs;
    const length = end - start + 1;
    return new Response(joined.subarray(offset, offset + length), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(length) },
    });
  } catch (e) {
    return new Response('Offline song unavailable', { status: 500 });
  }
}

// Allow the app to inspect / clear / prune the offline metadata cache
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'LMK_OFFLINE_STREAM_PING' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ type: 'LMK_OFFLINE_STREAM_PONG' });
  }
  if (data.type === 'LMK_OFFLINE_KEYS_CLEAR') streamKeys.clear();
  if (data.type === 'LMK_CLEAR_METADATA_CACHE') {
    event.waitUntil(caches.delete(METADATA_CACHE));
  }
  if (data.type === 'LMK_PRUNE_METADATA_CACHE') {
    event.waitUntil(pruneMetadataCache().catch(() => undefined));
  }
  if (data.type === 'LMK_METADATA_CACHE_STATS' && event.source) {
    event.waitUntil(
      caches
        .open(METADATA_CACHE)
        .then((cache) => cache.keys())
        .then((keys) =>
          event.source.postMessage({
            type: 'LMK_METADATA_CACHE_STATS_RESULT',
            entries: keys.length,
            version: CACHE_VERSION,
          })
        )
        .catch(() => undefined)
    );
  }
});


// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith(STREAM_PREFIX)) {
    event.respondWith(handleOfflineStream(request, url.pathname.slice(STREAM_PREFIX.length)));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith(MEDIA_PREFIX)) {
    const kind = url.searchParams.get('kind') || 'audio';
    event.respondWith(handleOfflineStream(request, null, { songId: url.pathname.slice(MEDIA_PREFIX.length), kind }));
    return;
  }

  // Never cache Vite dev/HMR modules or optimized dependency chunks.
  if (
    url.hostname === 'localhost' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/.vite/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.includes('__hmr') ||
    url.searchParams.has('t') ||
    url.searchParams.has('v')
  ) {
    return;
  }

  // Skip audio/media streaming — do not cache
  if (
    url.pathname.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i) ||
    request.headers.get('range') ||
    url.pathname.includes('/storage/v1/object/') ||
    url.pathname.includes('/audio/')
  ) {
    return;
  }

  // Song / album / playlist / article metadata + lyrics:
  // network-first, then fall back to the last good cached copy when offline.
  if (isCacheableMetadataRequest(request, url)) {
    maybePrune(event);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            event.waitUntil(putMetadata(request, response).catch(() => undefined));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: METADATA_CACHE });
          if (cached && !isExpired(cached)) {
            const headers = new Headers(cached.headers);
            headers.set('x-lmk-offline-cache', 'hit');
            return new Response(await cached.blob(), {
              status: cached.status,
              statusText: cached.statusText,
              headers,
            });
          }
          if (cached) {
            // Stale beyond the max age — drop it so it cannot resurface.
            const cache = await caches.open(METADATA_CACHE);
            await cache.delete(request);
          }
          return new Response('[]', {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'x-lmk-offline-cache': cached ? 'expired' : 'miss',
            },
          });
        })
    );
    return;
  }


  // Network-first for the rest of the API / auth / functions traffic
  if (
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('/functions/') ||
    url.hostname.includes('supabase')
  ) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Hashed build assets (/assets/name-HASH.js|css) never change: cache-first
  // so repeat visits load the app instantly, like a native app.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request, { cacheName: ASSET_CACHE }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other scripts: network-first so updates cannot mix stale JS chunks.
  if (request.destination === 'script' || url.pathname.match(/\.(js|mjs)$/i)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images (incl. cross-origin artwork/covers): stale-while-revalidate,
  // capped in size so the cache never grows unbounded.
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(svg|png|jpg|jpeg|webp|avif|ico|gif)$/i)
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && (response.status === 200 || response.type === 'opaque')) {
              cache.put(request, response.clone()).then(() => trimCache(IMAGE_CACHE, IMAGE_MAX_ENTRIES));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Cache-first for styles and fonts
  if (
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(css|woff2?|ttf|eot)$/i)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests: network-first, fall back to the cached shell so the
  // app can still run offline against cached metadata, then to offline.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(async () => {
          const shell = await caches.match('/index.html');
          return shell || caches.match('/offline.html');
        })
    );
    return;
  }

  // Default: network-first
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
