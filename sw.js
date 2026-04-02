// SERVICE WORKER — Kari Dashboard PWA  v2.0
var CACHE_NAME = 'kari-dashboard-v2.0';

var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = event.request.url;

  if (url.includes('sw.js')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.includes('.xlsx') || url.includes('/plans/') || url.includes('/Foto') ||
      url.includes('api.github.com') || url.includes('fonts.googleapis') ||
      url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(fetch(event.request).catch(function() {
      return new Response('Нет соединения', { status: 503 });
    }));
    return;
  }
  if (url.includes('index.html') || url.endsWith('/') || url.includes('manifest.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(function(resp) {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then(function(c) { c.put(event.request, resp.clone()); });
          }
          return resp;
        })
        .catch(function() { return caches.match(event.request); })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          caches.open(CACHE_NAME).then(function(c) { c.put(event.request, resp.clone()); });
        }
        return resp;
      });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
