var CACHE_NAME = 'portal-zakazov-v113';
var REQ_STATE_CACHE = 'kari-req-state'; // состояние фоновой проверки запросов (не удалять при обновлении)
// v1.73: только файлы приложения; шрифты Google кэшируются при первой загрузке (fetch-обработчик),
// чтобы недоступный/медленный fonts.googleapis.com не срывал установку обновления
var urlsToCache = [
  './',
  './index.html'
];

// v1.73: кэшируем в обход HTTP-кэша браузера (cache:'reload'), иначе в новый кэш
// попадала старая index.html из HTTP-кэша GitHub Pages и «Обновить» ничего не меняло.
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(urlsToCache.map(function(u) {
        return fetch(new Request(u, { cache: 'reload' })).then(function(r) {
          if (r && (r.ok || r.type === 'opaque')) return cache.put(u, r);
        }).catch(function() {});
      }));
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME && name !== REQ_STATE_CACHE;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

function isAppShell(req) {
  if (req.mode === 'navigate') return true;
  var u = new URL(req.url);
  return u.origin === self.location.origin && /\/(index\.html)?$/.test(u.pathname);
}

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = req.url;
  // Не кэшируем GitHub API и raw-файлы (данные должны быть свежими)
  if (url.includes('api.github.com') ||
      url.includes('raw.githubusercontent.com') ||
      url.includes('script.google.com') ||
      url.includes('fonts.gstatic.com')) {
    event.respondWith(fetch(req));
    return;
  }
  // v1.73: страница приложения — сначала сеть (свежая версия), офлайн — из кэша
  if (isAppShell(req)) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).then(function(resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put('./index.html', copy); });
        }
        return resp;
      }).catch(function() {
        return caches.match('./index.html').then(function(r) { return r || caches.match('./'); });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(function(response) {
      if (response) return response;
      return fetch(req).then(function(fetchResponse) {
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type === 'opaque') {
          return fetchResponse;
        }
        var responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, responseToCache);
        });
        return fetchResponse;
      });
    })
  );
});


// ══════════════ ЗАПРОСЫ МАГАЗИНУ: уведомления (v1.69) ══════════════
var REQ_STATE_URL = './__kari_req_state';

function reqStateGet() {
  return caches.open(REQ_STATE_CACHE).then(function (c) {
    return c.match(REQ_STATE_URL).then(function (r) { return r ? r.json() : null; });
  }).catch(function () { return null; });
}
function reqStatePut(st) {
  return caches.open(REQ_STATE_CACHE).then(function (c) {
    return c.put(REQ_STATE_URL, new Response(JSON.stringify(st), { headers: { 'Content-Type': 'application/json' } }));
  });
}

// Страница сообщает, какой магазин вошёл (или что вышли)
self.addEventListener('message', function (event) {
  var d = event.data;
  if (!d || d.type !== 'kari-req-state') return;
  if (d.clear) {
    event.waitUntil(caches.open(REQ_STATE_CACHE).then(function (c) { return c.delete(REQ_STATE_URL); }));
    return;
  }
  event.waitUntil(reqStateGet().then(function (old) {
    var notified = (d.notified || []).concat((old && old.storeId === d.storeId && old.notified) || []);
    return reqStatePut({ url: d.url, storeId: String(d.storeId), done: d.done || [],
      notified: notified.filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(-300) });
  }));
});

// Фоновая проверка новых запросов (установленное приложение, Chrome/Android)
function reqBackgroundCheck() {
  return reqStateGet().then(function (st) {
    if (!st || !st.url || !st.storeId) return;
    return fetch(st.url + '?action=req_list', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !Array.isArray(d.requests)) return;
        var sid = String(st.storeId);
        var fresh = d.requests.filter(function (r) {
          if (!r || !r.id || r.status === 'closed') return false;
          var tg = (r.targets === 'all' || !Array.isArray(r.targets)) ? null : r.targets.map(String);
          if (tg && tg.indexOf(sid) < 0) return false;
          if ((r.answered || []).map(String).indexOf(sid) >= 0) return false;
          if ((st.done || []).indexOf(r.id) >= 0) return false;
          return (st.notified || []).indexOf(r.id) < 0;
        });
        if (!fresh.length) return;
        st.notified = (st.notified || []).concat(fresh.map(function (r) { return r.id; })).slice(-300);
        return reqStatePut(st).then(function () {
          return self.registration.showNotification('📨 Запрос от менеджера', {
            body: fresh.length === 1 ? fresh[0].title : 'Новых запросов: ' + fresh.length,
            tag: 'kari-req', renotify: true, icon: 'icon-192.png', badge: 'icon-192.png',
            data: { url: self.registration.scope }
          });
        });
      });
  }).catch(function () {});
}
self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'kari-req-check') event.waitUntil(reqBackgroundCheck());
});

// Клик по уведомлению — открываем приложение (окно запроса откроется само)
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) return list[i].focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
