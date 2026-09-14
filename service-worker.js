'use strict';

// V1.8.78: KPI history true equal outer frames + cache-bust.

const CACHE_NAME = 'cnmi-temp-v1-8-78';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './style.css',
  './script.js',
  './supabase-backend.js',
  './pwa-install.js',
  './favicon.ico',
  './icons/icon-48.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-16x16.png',
  './icons/favicon-32x32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return Promise.allSettled(APP_SHELL.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' }));
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (key) {
          return key !== CACHE_NAME && key.indexOf('cnmi-temp-') === 0;
        }).map(function (key) {
          return caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Google Chat relay URL must never be held by the service-worker cache.
  if (url.pathname.endsWith('/chat-alert-config.js')) {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })));
    return;
  }

  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            const cacheRequest = request.mode === 'navigate'
              ? new Request('./index.html')
              : request;
            cache.put(cacheRequest, copy).catch(function () {});
          });
        }
        return response;
      })
      .catch(function () {
        return caches.match(request, { ignoreSearch: true }).then(function (cached) {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});

self.addEventListener('push', function (event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'CNMI Temperature Monitor', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'CNMI Temperature Monitor';
  const count = Number(payload.missingCount || 0);
  const options = {
    body: payload.body || 'มีรายการอุณหภูมิที่ต้องติดตาม',
    icon: './icons/icon-192.png',
    badge: './icons/icon-48.png',
    tag: payload.tag || 'cnmi-temp-reminder',
    renotify: true,
    data: {
      url: payload.url || '/?page=recordTemperature&source=push-reminder',
      round: payload.round || '',
      reminderSlot: payload.reminderSlot || '',
      notificationType: payload.notificationType || '',
      incidentId: payload.incidentId || ''
    }
  };

  event.waitUntil((async function () {
    try {
      if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
        if (count > 0) await self.navigator.setAppBadge(count);
        else if (typeof self.navigator.clearAppBadge === 'function') await self.navigator.clearAppBadge();
      }
    } catch (error) {}
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = new URL(event.notification?.data?.url || '/?page=recordTemperature&source=push-reminder', self.location.origin).href;

  event.waitUntil((async function () {
    try {
      if (self.navigator && typeof self.navigator.clearAppBadge === 'function') {
        await self.navigator.clearAppBadge();
      }
    } catch (error) {}

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      try {
        if (new URL(client.url).origin === self.location.origin) {
          if ('navigate' in client) await client.navigate(target);
          await client.focus();
          return;
        }
      } catch (error) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
