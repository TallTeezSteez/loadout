const CACHE_NAME = 'loadout-cache-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls — auth and data must always hit the real network.
  // If there's no connection, let these fail naturally rather than serving stale data.
  if (url.hostname.includes('supabase')) {
    return;
  }

  // Never cache the Supabase JS library itself either — it's critical to auth working
  // correctly, so it should always load fresh rather than risk running a frozen old copy.
  if (url.hostname.includes('jsdelivr.net')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    // Loading the app itself: try the network first so updates show up right away,
    // fall back to the cached shell if offline.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else (fonts, the Supabase JS library, icons): serve from cache
  // immediately if we have it, otherwise fetch and cache it for next time.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
