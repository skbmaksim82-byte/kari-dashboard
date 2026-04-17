const CACHE_NAME = 'portal-zakazov-v69';
const urlsToCache = [
  './',
  './index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp =>
      resp || fetch(event.request).then(r => {
        if (!r || r.status !== 200 || r.type !== 'basic') return r;
        const rc = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, rc));
        return r;
      })
    )
  );
});
