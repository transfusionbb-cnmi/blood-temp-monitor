/* CNMI Staff Planner PWA service worker — V591 OT rate override core persistence */
const WORKER_VERSION = '556';
const CACHE_PREFIX = 'cnmi-staff-planner-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v652`;
const EXTERNAL_CACHE_PREFIX = 'cnmi-external-deps-v';

const CORE_SHELL = [
  './', './index.html', './site.webmanifest',
  './app-styles-v569.css?v=570',
  './bootstrap-v545-dependency-failover.js?v=545',
  './app-bundle-v569-pre.js?v=569', './app-v545.js?v=591', './app-bundle-v569-01.js?v=591', './app-bundle-v569-05.js?v=652',
  './patch-v570-admin-temp-password-edge.js?v=570',
  './patch-v572-leave-overlap-guard.js?v=572',
  './patch-v574-multi-trade-hr-normalization.js?v=587',
  './patch-v577-ot-attendance-source-export-fix.js?v=604',
  './patch-v578-long-weekend-noduty-quota.js?v=578',
  './patch-v584-approved-tracking-source-of-truth.js?v=587',
  './patch-v585-ot-detail-performance.js?v=585',
  './patch-v587-staff-admin-ot-parity.js?v=587',
  './patch-v588-approval-canonical-parity.js?v=588',
  './patch-v589-trade-chain-net-hours-rate-override.js?v=589',
  './patch-v590-ot-rate-override-persistence.js?v=590',
  './patch-v591-ot-rate-core-persistence.js?v=591',
  './pwa-install-v303.css', './pwa-install-v556.js',
  './patch-v542-single-sidebar-deeplink-controller.js',
  './android-chrome-192x192.png', './android-chrome-512x512.png',
  './apple-touch-icon.png', './favicon-32x32.png', './favicon-16x16.png'
];

function registeredWorkerVersion() {
  try { return new URL(self.location.href).searchParams.get('v') || ''; }
  catch (_) { return ''; }
}

async function clearPlannerCaches() {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => key.startsWith(CACHE_PREFIX))
    .map((key) => caches.delete(key)));
}

async function forceClientsToNetwork() {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.allSettled(clientList.map(async (client) => {
    try {
      const url = new URL(client.url);
      url.searchParams.set('pwa_recover', WORKER_VERSION);
      await client.navigate(url.href);
    } catch (_) {}
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_SHELL.map(async (url) => {
      try {
        const request = new Request(url, { cache: 'reload' });
        const response = await fetch(request);
        if (response?.ok) await cache.put(request, response.clone());
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    /* Important V556 recovery:
       Some installed phones still have the registration URL sw.js?v=544 even though
       the server now serves this newer worker body. In that case the old registration
       must remove itself, clear planner caches and navigate clients once through the
       network. The fresh index then registers sw.js?v=556. */
    if (registeredWorkerVersion() !== WORKER_VERSION) {
      await clearPlannerCaches().catch(() => {});
      await self.registration.unregister().catch(() => false);
      await forceClientsToNetwork().catch(() => {});
      return;
    }

    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => (
      (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      || (key.startsWith(EXTERNAL_CACHE_PREFIX) && key !== 'cnmi-external-deps-v545')
    )).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_OLD_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/config.js') || url.pathname.endsWith('config.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const helper = url.pathname.endsWith('/donor-helper.html') || url.pathname.endsWith('donor-helper.html');
      const fallback = helper ? './donor-helper.html' : './index.html';
      try {
        const response = await fetch(new Request(request, { cache: 'no-store' }));
        if (response?.ok) await cache.put(fallback, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(request)) || (await cache.match(fallback)) || Response.error();
      }
    })());
    return;
  }

  const cacheableDestinations = new Set(['script', 'style', 'image', 'font', 'manifest']);
  if (!cacheableDestinations.has(request.destination)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // HTML navigations stay network-first above. Static files have versioned
    // URLs, so an exact cache hit avoids a network round trip on every launch.
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response?.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
