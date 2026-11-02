const CACHE_NAME = 'sanctum-v3';
const AUDIO_CACHE_NAME = 'sanctum-audio-v1';
const ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== AUDIO_CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// The daily reminder's poke. The payload is built server-side under a strict copy rule
// (see src/lib/pushCore.ts): a title, one plain sentence, and the URL to open. The
// fallbacks below repeat that same sentence so a malformed payload can never put
// unexpected words on a man's lock screen.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = {};
  }

  const title = typeof payload.title === 'string' ? payload.title : 'Sanctum';
  const body = typeof payload.body === 'string' ? payload.body : 'Your Gospel and reflection are ready.';
  const url = typeof payload.url === 'string' ? payload.url : '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'sanctum-daily-reminder',
      data: { url: url },
    })
  );
});

// A tap opens the app at the surface the payload names — the part of Sanctum the man
// chose to be reminded about. An already-open window is navigated and focused rather
// than duplicated; otherwise a new window opens.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  const url = new URL(target, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (new URL(client.url).origin === self.location.origin && 'navigate' in client) {
            return client
              .navigate(url)
              .then((navigated) => (navigated ? navigated.focus() : client.focus()))
              .catch(() => client.focus());
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// The daily Gospel audio lives in the public daily-audio bucket on the Supabase origin
// — cross-origin, which the handler below ignores entirely. This branch runs FIRST:
// those files are cache-first in their own cache, so after a day's first play its audio
// replays offline (the driveway test). Entries for dates older than 7 days are pruned
// whenever a new date is cached; the static bell has no date in its path and stays.
const AUDIO_PATH_MARKER = '/storage/v1/object/public/daily-audio/';

function pruneAudioCache(cache) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  return cache.keys().then((requests) =>
    Promise.all(
      requests
        .filter((request) => {
          const match = new URL(request.url).pathname.match(/daily-audio\/(\d{4}-\d{2}-\d{2})\//);
          return match && match[1] < cutoffKey;
        })
        .map((request) => cache.delete(request))
    )
  ).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'GET' && url.pathname.includes(AUDIO_PATH_MARKER)) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              cache.put(event.request, copy).then(() => pruneAudioCache(cache)).catch(() => {});
            }
            return res;
          });
        })
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;

  const isNavigation = event.request.mode === 'navigate';
  const isJS = url.pathname.startsWith('/assets/');

  if (isNavigation || isJS) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('/index.html'))
    )
  );
});
