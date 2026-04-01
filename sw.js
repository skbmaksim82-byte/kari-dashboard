// ══════════════════════════════════════════════════════
// SERVICE WORKER — Kari Dashboard PWA  v1.8
// ВАЖНО: при каждом обновлении дашборда менять CACHE_NAME
// ══════════════════════════════════════════════════════
var CACHE_NAME = 'kari-dashboard-v1.8';

var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: кешируем основные файлы и сразу активируемся ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      // Сразу вызываем skipWaiting — новый SW активируется немедленно
      // Уведомление показывается в index.html через updatefound → installed
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: удаляем все старые кеши ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      // Берём контроль над всеми открытыми вкладками немедленно
      return self.clients.claim();
    })
  );
});

// ── FETCH: Network-First для HTML, Cache-First для остального ──
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = event.request.url;

  // sw.js никогда не кешируем — браузер должен всегда проверять его
  if (url.includes('sw.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Большие файлы — только сеть
  if (url.includes('.xlsx') || url.includes('/plans/') || url.includes('/Foto') ||
      url.includes('api.github.com') || url.includes('fonts.googleapis') ||
      url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response('Нет соединения', { status: 503 });
      })
    );
    return;
  }

  // index.html и manifest.json — Network-First (всегда свежие)
  if (url.includes('index.html') || url.endsWith('/') || url.includes('manifest.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Остальное (иконки, шрифты) — Cache-First
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      });
    })
  );
});

// ── MESSAGE: команда от приложения ──
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
