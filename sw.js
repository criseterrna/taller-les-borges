/* Funciona sin conexión: guarda la app y el lector de facturas en el móvil */
const CACHE = 'taller-lb-v2';
const CORE = ['./', './index.html', './app.js', './manifest.webmanifest', './icons/logo.svg', './icons/icon-192.png', './icons/icon-512.png', './vendor/jspdf.umd.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isApi = /nhtsa|regcheck/.test(url.hostname);
  if (isApi) return; // consultas externas: siempre en directo
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => hit)));
});
