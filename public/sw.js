// DayScore Service Worker v2.3 (Build: 2026-09-05-HighResIcons)
const SW_VERSION = 'dayscore-sw-v2.3-2026-09-05-HighResIcons';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
    tag: data.tag || `dayscore-notif-${Date.now()}`,
    data: {
      url: data.url || '/'
    },
    renotify: true,
    vibrate: [200, 100, 200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions).catch((err) => {
      console.warn('showNotification rich options failed, falling back to minimal notification:', err);
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
        console.warn('Push subscription change renewal note:', err);
      })
  );
});
