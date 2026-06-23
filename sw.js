const CACHE_NAME = 'foxpay-pwa-v65';
const CACHE_PREFIX = 'foxpay-pwa-';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.png',
  '/logo2-meta.jpg',
  '/images/fox-optimized.webp',
  '/images/sleeping-optimized.webp',
  '/images/UX/coinfox-optimized.webp',
  '/images/bakground.jpg',
  '/images/icons/icons card/iconos_10.png',
  '/images/icons/icons card/iconos_05.png',
  '/images/icons/icons card/iconos_07.png',
  '/images/icons/icons card/iconos_03.png',
  '/images/icons/icons card/reloj.png',
  '/images/icons/icons card/exchange.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;

  const extension = url.pathname.split('.').pop();
  const isLiveDocument = event.request.mode === 'navigate' || ['/', '/index.html', '/story', '/story/', '/foxpay-story.html', '/terms', '/terms/', '/foxpay-terms.html'].includes(url.pathname);
  const isLiveCode = ['html', 'css', 'js'].includes(extension) || ['/sw.js', '/manifest.webmanifest'].includes(url.pathname);

  if (isLiveDocument || isLiveCode) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
