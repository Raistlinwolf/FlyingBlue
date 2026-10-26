// Minimal service worker: makes the app installable, caches static build assets and
// shows an offline page when navigation fails. Data is always fetched live from
// Supabase. Paths are resolved against the registration scope, so the same worker
// works at the site root and under a sub-path (GitHub Pages: /FlyingBlue/).
const VERSION = 'v2';
const STATIC_CACHE = `static-${VERSION}`;
const SCOPE = new URL(self.registration.scope).pathname; // e.g. "/FlyingBlue/"
const OFFLINE_URL = `${SCOPE}offline.html`;
const PRECACHE = [OFFLINE_URL, `${SCOPE}icon.svg`, `${SCOPE}icons/icon-192.png`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase requests are never cached

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith(`${SCOPE}_next/static/`) || url.pathname.startsWith(`${SCOPE}icons/`)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
