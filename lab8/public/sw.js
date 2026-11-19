const cachePrefix = 'lab8-contacts-shell-';
const cacheName = cachePrefix + 'v1';
const shell = [
  '/',
  '/style.css',
  '/app.js',
  '/contact.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(shell.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldKeys = keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName);
    await Promise.all(oldKeys.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !shell.includes(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(url.pathname)) || fetch(request);
  })());
});
