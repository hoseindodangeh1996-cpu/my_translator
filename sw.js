// Bump this string on every deploy (or just leave the timestamp comment updated)
// to force old caches to be dropped and new assets to be fetched.
const CACHE_VERSION = 'v2-2026-09-27';
const CACHE_NAME = `fa-hy-translator-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// Install: pre-cache the app shell, then activate immediately (don't wait
// for old tabs to close).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete any caches from previous versions, then take control of
// open tabs immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Never intercept calls to the AI APIs (Groq / Gemini) — those must
//   always hit the network live.
// - For navigation/HTML requests: network-first, so a new deploy is picked
//   up immediately; fall back to cache only if offline.
// - For other same-origin assets: cache-first with a network fallback.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Let API calls pass straight through — no caching, no interception.
  if (
    url.hostname.includes('groq.com') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkResponse) => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return networkResponse;
      });
    })
  );
});
