const CACHE_NAME = 'lmk-cache-v3';
const METADATA_CACHE = 'lmk-metadata-v1';
const KNOWN_CACHES = [CACHE_NAME, METADATA_CACHE];

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

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('lmk-') && !KNOWN_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Allow the app to inspect / clear the offline metadata cache
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'LMK_CLEAR_METADATA_CACHE') {
    event.waitUntil(caches.delete(METADATA_CACHE));
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
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches
              .open(METADATA_CACHE)
              .then((cache) => cache.put(request, clone))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: METADATA_CACHE });
          if (cached) {
            const headers = new Headers(cached.headers);
            headers.set('x-lmk-offline-cache', 'hit');
            return new Response(await cached.blob(), {
              status: cached.status,
              statusText: cached.statusText,
              headers,
            });
          }
          return new Response('[]', {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'x-lmk-offline-cache': 'miss',
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

  // Network-first for scripts so app updates cannot mix stale JS chunks.
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

  // Cache-first for static non-script assets
  if (
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.match(/\.(css|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico|gif)$/i)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
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
