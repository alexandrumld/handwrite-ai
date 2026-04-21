// sw.js - Simple Service Worker
self.addEventListener('install', (e) => {
  console.log('[ServiceWorker] Install');
});

self.addEventListener('activate', (e) => {
  console.log('[ServiceWorker] Activate');
});

self.addEventListener('fetch', (event) => {
  console.log('[ServiceWorker] Fetch', event.request.url);
});