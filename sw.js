// Offline cache: app shell + data fetched network-first; audio and CDN cache-first.
const V = 'hanyu-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  const cacheFirst = url.pathname.startsWith('/audio/') || url.pathname.startsWith('/data/strokes/') || url.hostname !== location.hostname;
  if (cacheFirst) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(V).then((c) => c.put(req, cp)); } return res; })));
    return;
  }
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(req, cp)); } return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match('/'))));
});
