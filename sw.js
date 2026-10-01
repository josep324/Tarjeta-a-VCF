const CACHE = 'tarjeta-vcf-v6';
const SHELL = ['./', 'index.html', 'app.js', 'parser.js', 'config.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const CDN = ['cdn.jsdelivr.net', 'unpkg.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin && !CDN.includes(url.hostname)) return;

  if (sameOrigin) {
    // Xarxa primer (sempre l'última versió); còpia local només si no hi ha connexió
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return r;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }
  // CDN (motor OCR): còpia local primer
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) cache.put(req, r.clone());
      return r;
    })
  );
});
