/* 6 Nights at Camp – service worker (generated at build time). */
const CACHE = 'camp-__BUILD_ID__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('camp-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network first (so a new deploy shows up straight away), cached copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      Promise.race([fetch(req, { cache: 'no-store' }), timeout(4000)])
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('index.html', copy));
          }
          return res;
        })
        .catch(() => caches.open(CACHE).then((c) => c.match('index.html').then((r) => r || c.match('./')))),
    );
    return;
  }

  // Built files have unique names, so the cache is always right for them.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && url.pathname.includes('/assets/')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
