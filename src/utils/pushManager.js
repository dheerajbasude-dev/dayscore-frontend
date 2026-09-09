import { getApiBaseUrl } from './api';

const DEFAULT_VAPID_PUBLIC_KEY = 'BKB-dF7duYthvdifEwgOCeqR1dKFL9Y5p8kYP4gz1JfP8_ZXPH1e2tubFOe4xReycNzEm4mhrGqJT4-UNXjuIOU';

/**
 * Convert a base64 string to a Uint8Array for PushManager subscription
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the current browser environment supports Push Notifications & Service Worker
 */
export function isPushNotificationSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Fetch VAPID public key from backend or fallback to env / default
 */
export async function getVapidPublicKey() {
  try {
    const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (envKey && envKey.trim()) {
      return envKey.trim();
    }
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/notifications/vapid-public-key`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.publicKey) {
        return data.publicKey;
      }
    }
  } catch (err) {
    console.warn('Could not fetch dynamic VAPID key, using default:', err);
  }
  return DEFAULT_VAPID_PUBLIC_KEY;
}

/**
 * Get current push subscription if it exists
 */
export async function getExistingPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (e) {
    console.warn('Error reading push subscription:', e);
    return null;
  }
}

/**
 * Subscribe current device to Web Push notifications and sync with backend
 */
export async function subscribeToPushNotifications(forceRenew = false) {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported by your current browser.');
  }

  // 1. Request user permission
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  // 2. Ensure Service Worker registration is active and updated
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js');
  }
  reg = await navigator.serviceWorker.ready;
  try {
    await reg.update();
  } catch (e) {}

  // 3. Obtain VAPID Public Key & subscribe
  const vapidPublicKey = await getVapidPublicKey();
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  let subscription = await reg.pushManager.getSubscription();

  // If forceRenew is requested, attempt safe renewal
  if (subscription && forceRenew) {
    try {
      const oldEndpoint = subscription.endpoint;
      await subscription.unsubscribe();
      subscription = null;
      // Also notify backend to remove old endpoint
      const token = localStorage.getItem('dayscore_token');
      const baseUrl = getApiBaseUrl();
      fetch(`${baseUrl}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ endpoint: oldEndpoint })
      }).catch(() => {});
    } catch (unsubErr) {
      console.warn('Unsubscribe during renewal note:', unsubErr);
    }
  }

  if (!subscription) {
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    } catch (subErr) {
      console.warn('Push subscribe attempt note, retrieving existing subscription:', subErr);
      subscription = await reg.pushManager.getSubscription();
      if (!subscription) throw subErr;
    }
  }

  if (subscription && subscription.endpoint) {
    try {
      localStorage.setItem('dayscore_last_push_endpoint', subscription.endpoint);
    } catch (e) {}
  }

  // 4. Send subscription payload to backend MongoDB
  const token = localStorage.getItem('dayscore_token');
  const baseUrl = getApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn('Push registration server note:', errData?.error || response.statusText);
    }
  } catch (netErr) {
    console.warn('Push registration network note:', netErr);
  }

  return subscription;
}

/**
 * Unsubscribe current device from Web Push notifications
 */
export async function unsubscribePushNotifications() {
  if (!isPushNotificationSupported()) return;
  try {
    let endpoint = null;
    try {
      endpoint = localStorage.getItem('dayscore_last_push_endpoint') || null;
      localStorage.removeItem('dayscore_last_push_endpoint');
    } catch (e) {}

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        endpoint = subscription.endpoint || endpoint;
        await subscription.unsubscribe();
      }
    } catch (subErr) {
      console.warn('Service worker unsubscription note:', subErr);
    }

    if (endpoint) {
      const token = localStorage.getItem('dayscore_token');
      const baseUrl = getApiBaseUrl();

      await fetch(`${baseUrl}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ endpoint })
      }).catch(e => console.warn('Unsubscribe API call error:', e));
    }
  } catch (e) {
    console.warn('Unsubscribe error:', e);
  }
}

/**
 * Dispatch live test push notification from backend
 */
export async function dispatchTestPushNotification(leadTimeMinutes = 30) {
  const token = localStorage.getItem('dayscore_token');
  const baseUrl = getApiBaseUrl();

  let endpoint = null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) endpoint = sub.endpoint;
  } catch (e) {}

  const response = await fetch(`${baseUrl}/api/notifications/test-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ leadTime: leadTimeMinutes, endpoint })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to dispatch test push from server.');
  }

  return response.json();
}
