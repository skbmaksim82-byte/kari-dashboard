const CACHE_VERSION = 'kari-v1.17';
const ASSETS = ['/', '/index.html', '/manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.hostname === 'raw.githubusercontent.com' || u.hostname === 'api.github.com') { e.respondWith(fetch(e.request)); return; }
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
