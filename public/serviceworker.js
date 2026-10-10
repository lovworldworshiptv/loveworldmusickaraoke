// ---------------------------------------------------------------------------
// Cache versioning
// Bump CACHE_VERSION on any release that changes the app shell, the cached
// metadata shape, or the lyrics format. Every cache name is derived from it,
// so old caches are dropped automatically on activate.
// ---------------------------------------------------------------------------
const CACHE_VERSION = 'v5';
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

// Allow the app to inspect / clear / prune the offline metadata cache
self.addEventListener('message', (event) => {
  const data = event.data || {};
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
