// DayScore Service Worker v3.2 (Build: 2026-09-09-MissedAtDue)
const SW_VERSION = 'dayscore-sw-v3.2-2026-09-09-MissedAtDue';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ──────────────────────────────────────────────────────────────────────────────
// CRITICAL: fetch event handler
// Chrome on Desktop AND Android considers a service worker without a fetch
// handler as "non-functional" and may terminate it aggressively when all tabs
// are closed. By adding a fetch handler (even a pass-through), Chrome keeps
// the SW process alive in the background, allowing push events to fire
// immediately even when no tab is open.
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Pass-through: let the browser handle all fetch requests normally.
  // We do NOT intercept or cache anything — this handler exists solely
  // to keep the service worker alive for background push delivery.
  return;
});

// 1. Receive background Push Notification from server (even when app/tab is completely closed)
self.addEventListener('push', (event) => {
  let data = {
    title: '⏰ DayScore Reminder',
    body: 'You have a scheduled task reminder.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    url: '/',
    tag: 'dayscore-push-reminder'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-96.png',
    tag: data.tag || ('dayscore-notif-' + Date.now()), // Respect deduplication tag
    data: {
      url: data.url || '/'
    },
    renotify: true,
    requireInteraction: true, // Keep notification persistently displayed on lock screen until user interacts
    silent: false, // Explicitly tell Android to play sound/vibrate and not mute in background
    timestamp: data.timestamp || Date.now(),
    vibrate: [500, 200, 500, 200, 500], // Crisp high-visibility vibration alert pattern
    actions: [
      { action: 'open', title: 'Open Task' }
    ]
  };

  // event.waitUntil() is CRITICAL — it tells the browser "don't kill this SW
  // until the notification has been shown". Without it, the SW can be terminated
  // before showNotification() completes, resulting in a silent/dropped push.
  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions).catch((err) => {
      console.warn('[SW] showNotification rich options failed, falling back to minimal notification:', err);
      return self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192.png'
      });
    })
  );
});

// 2. Handle user clicking notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url && client.url.includes(self.location.origin)) {
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
      }
      // If no window is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. Handle push subscription changes (e.g. browser refreshed keys)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((subscription) => {
        const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : '';
        return fetch('/api/notifications/refresh-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint,
            newSubscription: subscription.toJSON ? subscription.toJSON() : subscription
          })
        });
      })
      .catch((err) => {
        console.warn('[SW] Push subscription change renewal note:', err);
      })
  );
});
