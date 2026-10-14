const CACHE = 'k-shell-__BUILD__';
const ASSETS = __ASSETS__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('k-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
  }
});
