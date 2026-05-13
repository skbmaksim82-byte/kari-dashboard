var CACHE_NAME = 'portal-zakazov-v70';
var urlsToCache = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Inter:wght@300;400;500&display=swap'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  // Не кэшируем GitHub API и raw-файлы (данные должны быть свежими)
  if (url.includes('api.github.com') ||
      url.includes('raw.githubusercontent.com') ||
      url.includes('script.google.com') ||
      url.includes('fonts.gstatic.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) return response;
      return fetch(event.request).then(function(fetchResponse) {
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type === 'opaque') {
          return fetchResponse;
        }
        var responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseToCache);
        });
        return fetchResponse;
      });
    })
  );
});
