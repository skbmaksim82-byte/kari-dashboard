var CACHE_NAME = 'portal-zakazov-v60';
var URLS_TO_CACHE = ['/Portal-zakazov/', '/Portal-zakazov/index.html'];
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(URLS_TO_CACHE); }));
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
  }));
});
self.addEventListener('fetch', function(e) {
  e.respondWith(caches.match(e.request).then(function(r){ return r || fetch(e.request); }));
});