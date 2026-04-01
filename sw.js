// ══════════════════════════════════════════════════════
// SERVICE WORKER — Kari Dashboard PWA
// Версия кеша — меняется при каждом обновлении дашборда
// ══════════════════════════════════════════════════════
var CACHE_NAME = 'kari-dashboard-v1.2';

// Файлы, которые кешируем при установке
var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// ── INSTALL: кешируем основные файлы ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // НЕ вызываем skipWaiting() автоматически — ждём команды от приложения
  // чтобы пользователь мог сам решить когда обновиться
});

// ── ACTIVATE: удаляем старые кеши ──
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

// ── FETCH: стратегия Network-First ──
// Сначала пробуем сеть (чтобы всегда получать свежие данные из GitHub),
// при ошибке сети — отдаём из кеша
self.addEventListener('fetch', function(event) {
  // Пропускаем не-GET запросы и запросы к другим доменам (кроме GitHub)
  if (event.request.method !== 'GET') return;

  var url = event.request.url;

  // Для xlsx, планировок и фото — только сеть (не кешируем большие файлы)
  if (url.includes('.xlsx') || url.includes('/plans/') || url.includes('/Foto') ||
      url.includes('api.github.com') || url.includes('fonts.googleapis') ||
      url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Для основного приложения — Network-First
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(function(response) {
        // Кешируем свежий ответ
        if (response && response.status === 200 && response.type === 'basic') {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(function() {
        // Сеть недоступна — берём из кеша
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // Если нет в кеше — отдаём главную страницу (для SPA)
          return caches.match('./index.html');
        });
      })
  );
});

// ── MESSAGE: команда от приложения на немедленное обновление ──
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
