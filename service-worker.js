'use strict';

// V1.8.41: KPI detailed missing reason and cache refresh.

const CACHE_NAME = 'cnmi-temp-v1-8-41';
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

  // V1.8.23: ไฟล์นี้มี URL Relay ของ Google Chat ต้องอ่านสดจาก GitHub ทุกครั้ง ห้ามค้างค่าเก่า
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
