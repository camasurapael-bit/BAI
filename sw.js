/* bai Hotel service worker: makes the site installable and keeps the shell available offline.
   HTML/CSS/JS: network first (so updates show immediately), cache as fallback.
   Images/icons: cache first. Firebase, fonts and other sites are never touched. */
const CACHE = 'bai-hotel-v5';
const SHELL = ['./', 'index.html', 'admin.html', 'css/styles.css', 'css/admin.css', 'js/main.js', 'js/auth.js', 'js/admin.js',
  'js/pwa.js', 'js/qr.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isAsset = /\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname);
  if (isAsset) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
