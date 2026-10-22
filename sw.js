/* Funciona sin conexión. La app (HTML y JS) se busca primero en internet para recibir mejoras; las librerías, primero en el móvil. */
const CACHE = 'taller-lb-v3';
const CORE = ['./', './index.html', './app.js', './manifest.webmanifest', './icons/logo.svg', './icons/icon-192.png', './icons/icon-512.png', './vendor/jspdf.umd.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/nhtsa|regcheck/.test(url.hostname)) return;
  const put = res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
  const appFile = url.origin === location.origin && !url.pathname.includes('/vendor/') && !url.pathname.includes('/icons/');
  if (appFile) { e.respondWith(fetch(req).then(put).catch(() => caches.match(req, {ignoreSearch:true}))); return; }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(put)));
});
