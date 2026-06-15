const CACHE_VERSION = 'koreanspeak-v5';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/00-design-system.css',
  './css/01-animations.css',
  './css/02-components.css',
  './css/03-screens.css',
  './css/04-utilities.css',
  './js/00-config.js',
  './js/01-state.js',
  './js/02-router.js',
  './js/03-audio-engine.js',
  './js/04-speech-recognition.js',
  './js/05-curriculum-data.js',
  './js/06-srs-algorithm.js',
  './js/07-gamification.js',
  './js/09-ui-renderer.js',
  './js/10-gesture-handler.js',
  './js/11-haptic-feedback.js',
  './js/12-ai-conversation.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name.startsWith('koreanspeak-') && name !== STATIC_CACHE && name !== AUDIO_CACHE)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.destination === 'audio' || request.headers.get('accept')?.includes('audio')) {
    event.respondWith(audioCacheStrategy(request));
    return;
  }

  event.respondWith(staticCacheStrategy(request));
});

async function staticCacheStrategy(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline - Resource not available', { status: 503 });
  }
}

async function audioCacheStrategy(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(AUDIO_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 404 });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncOfflineProgress());
  }
});

async function syncOfflineProgress() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'sync-complete' });
  });
}

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'KoreanSpeak', {
      body: data.body || 'Time for your daily Korean practice!',
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
      tag: data.tag || 'daily-reminder',
      requireInteraction: false,
      data: data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(self.registration.scope)
  );
});
