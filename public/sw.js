const CACHE_NAME = 'fpl-scout-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/recommendations',
  '/spy',
  '/admin',
  '/style.css',
  '/utils.js',
  '/layout.js',
  '/app.js',
  '/blog.js',
  '/admin.js'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.log('Cache installation failed:', err))
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First Strategy
self.addEventListener('fetch', event => {
  // Skip API calls - always go to network
  if (event.request.url.includes('/api/')) {
    return event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: 'Offline - API not available' }),
            { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
  }

  // For other requests: Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Avoid caching dynamic blog page HTML for route freshness
        if (!response || response.status !== 200 || event.request.url.includes('/blog')) {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone))
          .catch(() => {});

        return response;
      })
      .catch(() => {
        // Return cached version if network fails
        return caches.match(event.request)
          .then(response => {
            return response || new Response('Offline - Page not cached', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background Sync for future use
self.addEventListener('sync', event => {
  if (event.tag === 'sync-watchlist') {
    event.waitUntil(
      // Add sync logic here
      Promise.resolve()
    );
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === targetUrl || client.url === new URL(targetUrl, self.location.origin).href) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('push', event => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || 'FPL Scout Reminder';
  const options = {
    body: payload.body || 'Check your account for the latest subscription update.',
    icon: '/images/favicon.svg',
    badge: '/images/favicon.svg',
    data: payload.data || { url: '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
