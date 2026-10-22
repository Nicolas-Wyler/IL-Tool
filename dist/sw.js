const CACHE = 'plane-wave-1.0.51-local';
const ASSETS = ['./', './index.html', './style.css', './app.js', './preferences.js', './dev-watch.js', './table-layout.js', './exports.js', './export-data.js', './settings.js', './page-controls.js', './field.js', './updates.js', './gratings.js', './grating-geometry.js', './center-squares.js', './linked-rows.js', './numbers.js', './history.js', './framing.js', './persistence.js', './table.js', './viewport.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('plane-wave-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (new URL(event.request.url).pathname.startsWith('/__dev/')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response.ok) {
        const cache = await caches.open(CACHE);
        const path = new URL(event.request.url).pathname;
        if (ASSETS.some(asset => new URL(asset, self.registration.scope).pathname === path)) {
          await cache.put(event.request, response.clone());
        }
      }
      return response;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw error;
    }
  })());
});
