const CACHE_NAME = 'lmk-cache-v2';
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Precaching offline shell');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (
    url.pathname.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i) ||
    request.headers.get('range') ||
    url.pathname.includes('/storage/v1/object/') ||
    url.pathname.includes('/audio/')
  ) {
    return;
  }

  if (
    request.mode === 'navigate' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.includes('/node_modules/.vite/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('/functions/') ||
    url.hostname.includes('supabase')
  ) {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.match(/\.(woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico|gif)$/i)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
