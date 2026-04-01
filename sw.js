// ══════════════════════════════════════════════════════
// SERVICE WORKER — Kari Dashboard PWA
// При каждом обновлении менять ОБЕ версии: CACHE_NAME и APP_VERSION
// ══════════════════════════════════════════════════════
var CACHE_NAME  = 'kari-dashboard-v1.9';
var APP_VERSION = '1.9'; // должна совпадать с APP_VERSION в index.html

var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: кешируем и сразу активируемся ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function() { return self.skipWaiting(); })
  );
});

// ── ACTIVATE: удаляем ВСЕ старые кеши ──
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

// ── FETCH ──
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = event.request.url;

  // sw.js — никогда не кешируем
  if (url.includes('sw.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Большие внешние файлы — только сеть
  if (url.includes('.xlsx') || url.includes('/plans/') || url.includes('/Foto') ||
      url.includes('api.github.com') || url.includes('fonts.googleapis') ||
      url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(fetch(event.request).catch(function() {
      return new Response('Нет соединения', { status: 503 });
    }));
    return;
  }

  // index.html и manifest — Network-First, всегда свежие
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

  // Остальное — Cache-First
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

// ── MESSAGE ──
self.addEventListener('message', function(event) {
  if (!event.data) return;

  // Команда обновиться
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Проверка версии — если не совпадает, сбрасываем кеши и перезагружаем
  if (event.data.type === 'CHECK_VERSION') {
    if (event.data.version && event.data.version !== APP_VERSION) {
      // Удаляем все кеши и говорим странице перезагрузиться
      caches.keys().then(function(names) {
        return Promise.all(names.map(function(n) { return caches.delete(n); }));
      }).then(function() {
        self.clients.matchAll().then(function(clients) {
          clients.forEach(function(client) {
            client.postMessage({ type: 'FORCE_RELOAD' });
          });
        });
      });
    }
  }
});
