// ─── SERVICE WORKER — Kari Dashboard ───
// Версия кэша — меняется при каждом деплое (совпадает с APP_VERSION в index.html)
var CACHE_VERSION = 'kari-v1.14';
var CACHE_NAME = CACHE_VERSION;

// Файлы для кэширования при установке
var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ─── УСТАНОВКА ───
self.addEventListener('install', function(event) {
  // Новый SW активируется сразу, не ждёт закрытия вкладок
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// ─── АКТИВАЦИЯ — удаляем старые кэши ───
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          // Удаляем все кэши кроме текущего
          return cacheName.startsWith('kari-') && cacheName !== CACHE_NAME;
        }).map(function(cacheName) {
          console.log('[SW] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      // Берём управление всеми вкладками немедленно
      return self.clients.claim();
    })
  );
});

// ─── СТРАТЕГИЯ ЗАГРУЗКИ: Network First (всегда свежее из сети) ───
// Для GitHub Pages: всегда пробуем сеть первой.
// Если сеть недоступна — отдаём из кэша.
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Обрабатываем только GET-запросы
  if (request.method !== 'GET') return;

  // Для запросов к GitHub API — только сеть (no-cache), без SW-перехвата
  if (request.url.includes('api.github.com') ||
      request.url.includes('fonts.googleapis.com') ||
      request.url.includes('fonts.gstatic.com') ||
      request.url.includes('cdnjs.cloudflare.com')) {
    return; // Пропускаем — браузер обрабатывает напрямую
  }

  event.respondWith(
    // Пробуем сеть первой (с cache-busting для основного файла)
    fetch(request, { cache: 'no-cache' })
      .then(function(networkResponse) {
        // Успех — сохраняем в кэш и возвращаем
        if (networkResponse && networkResponse.status === 200) {
          var responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(function() {
        // Сеть недоступна — берём из кэша
        return caches.match(request).then(function(cachedResponse) {
          if (cachedResponse) {
            console.log('[SW] Serving from cache (offline):', request.url);
            return cachedResponse;
          }
          // Ничего нет — возвращаем заглушку
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:40px">' +
            '<h2>📵 Нет подключения</h2>' +
            '<p>Дашборд недоступен офлайн для этого ресурса.</p>' +
            '<button onclick="location.reload()">Попробовать снова</button>' +
            '</body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
  );
});

// ─── ПЕРИОДИЧЕСКАЯ ПРОВЕРКА ОБНОВЛЕНИЙ ───
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.registration.update();
  }
});
