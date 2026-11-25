/* LabDeck service worker — caches the app shell and reuses downloaded content offline. */
const SHELL_CACHE = 'labdeck-shell-v4';
const RUNTIME_CACHE = 'labdeck-runtime-v4';
const PACK_CACHE = 'labdeck-packs-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/onboarding.css',
  './assets/pack-hashes.js',
  './assets/security.js',
  './assets/catalog.js',
  './assets/onboarding.js',
  './assets/app.js',
  './assets/terminal.js',
  './assets/pylab.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, PACK_CACHE]);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Course packs: cache-first, then network (and store the result for reuse).
  if (url.pathname.includes('/data/packs/')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Python runtime from the pinned CDN: cache-first so labs work offline after one download.
  if (url.origin !== self.location.origin) {
    if (url.hostname !== 'cdn.jsdelivr.net') return; // only the pinned CDN is ever fetched
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Navigations: network-first, fall back to the cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Everything else: cache-first.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
