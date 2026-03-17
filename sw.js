// EduPath Service Worker v10.0
const CACHE_NAME = 'edupath-v10.0';
const FONT_CACHE = 'edupath-fonts-v1';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Domains to NEVER intercept — let them go straight to network
const BYPASS_DOMAINS = [
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  'api.brevo.com',
  'www.gstatic.com',
];

// ── Install ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).catch(err => console.warn('[SW] Cache partial fail:', err))
    )
  );
  self.skipWaiting();
});

// ── Activate ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Firebase, Brevo, or gstatic requests
  if (BYPASS_DOMAINS.some(d => url.hostname.includes(d))) {
    return; // let browser handle it normally
  }

  // Never intercept non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Google Fonts — cache first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // App shell — cache first, network fallback
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.json') || url.pathname.endsWith('.png')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => cached)
      )
    );
    return;
  }

  // Everything else — network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ── Messages ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
    const { title, body, delayMs, tag } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title || 'EduPath Study Reminder', {
        body: body || 'Time to study! Keep your streak alive.',
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: tag || 'edupath-reminder',
        renotify: true,
        data: { url: './' },
        actions: [
          { action: 'study', title: 'Study Now' },
          { action: 'snooze', title: 'Snooze 1hr' }
        ]
      });
    }, delayMs || 0);
  }
  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('EduPath', {
      body: event.data.body || 'Notifications are working!',
      icon: './icon-192.png',
      tag: 'edupath-test',
      data: { url: './' }
    });
  }
});

// ── Notification click ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'snooze') {
    setTimeout(() => {
      self.registration.showNotification('EduPath Reminder', {
        body: 'Your 1-hour snooze is up! Ready to study?',
        icon: './icon-192.png',
        tag: 'edupath-reminder',
        renotify: true,
        data: { url: './' }
      });
    }, 60 * 60 * 1000);
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

// ── Push ──
self.addEventListener('push', event => {
  let data = { title: 'EduPath', body: 'Time to study!' };
  try { data = event.data ? event.data.json() : data; } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      tag: 'edupath-push',
      data: { url: './' }
    })
  );
});
