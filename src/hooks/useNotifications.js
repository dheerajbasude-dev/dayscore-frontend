import { useState, useEffect, useCallback } from 'react';

export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Pleasant two-tone chime (E5 -> G5)
    osc.frequency.setValueAtTime(659.25, ctx.currentTime);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn('AudioContext chime failed:', e);
  }
}

const notifiedKey = 'dayscore_notified_task_events';

function getNotifiedEvents() {
  try {
    const data = sessionStorage.getItem(notifiedKey);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch {
    return new Set();
  }
}

function markEventNotified(eventId) {
  try {
    const set = getNotifiedEvents();
    set.add(eventId);
    sessionStorage.setItem(notifiedKey, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export async function triggerDesktopNotification(title, body, tag = 'dayscore-notif') {
  if (!('Notification' in window)) {
    return { success: false, reason: 'unsupported' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch (e) {
      console.warn('requestPermission error:', e);
    }
  }

  if (permission !== 'granted') {
    return { success: false, reason: 'permission_denied', permission };
  }

  // 1. Play single audio chime sound
  playNotificationSound();

  let displayed = false;
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  const transparentIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAA';

  // 2. Service Worker showNotification (Primary on Desktop Chrome, Windows & Mobile)
  if ('serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
      }
      reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: isMobile ? transparentIcon : '/icons/icon-192.png',
          badge: '/icons/badge-96.png',
          tag: tag,
          renotify: true,
          requireInteraction: true,
          vibrate: [200, 100, 200]
        });
        displayed = true;
      }
    } catch (err) {
      console.warn('SW showNotification error:', err);
    }
  }

  // 3. Fallback to standard window Notification if ServiceWorker didn't show
  if (!displayed) {
    try {
      const notif = new Notification(title, {
        body,
        icon: isMobile ? transparentIcon : '/icons/icon-192.png',
        tag: tag,
        requireInteraction: true
      });
      notif.onclick = () => {
        try { window.focus(); } catch (e) {}
        try { notif.close(); } catch (e) {}
      };
      displayed = true;
    } catch (err) {
      console.warn('Standard Notification error:', err);
    }
  }

  return { success: displayed, permission };
}

import { subscribeToPushNotifications, isPushNotificationSupported } from '../utils/pushManager';

async function markTaskNotifiedOnServer(taskId, type, leadMinutes) {
  try {
    const token = localStorage.getItem('dayscore_token');
    const baseUrl = import.meta.env.VITE_API_URL || '';
    await fetch(`${baseUrl}/api/notifications/mark-notified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ taskId, type, leadMinutes })
    });
  } catch (e) {
    // Non-blocking background sync
  }
}

export function useNotifications(tasks, enabled, leadTimeMinutes = 30) {
  const [permissionGranted, setPermissionGranted] = useState(false);

  const checkPermission = useCallback(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const granted = Notification.permission === 'granted';
      setPermissionGranted(granted);

      // If notifications are enabled and permission is granted, ensure active registration with backend
      if (granted && enabled !== false && isPushNotificationSupported()) {
        const token = localStorage.getItem('dayscore_token');
        if (token) {
          subscribeToPushNotifications().catch(err => {
            // Silently log; does not disrupt user flow
            console.debug('Background push subscription sync note:', err?.message || err);
          });
        }
      }
    }
  }, [enabled]);

  useEffect(() => {
    checkPermission();
  }, [enabled, checkPermission]);

  // Precision in-app reminders & heartbeat when DayScore is open (foreground or background tab)
  useEffect(() => {
    if (!enabled || !tasks || tasks.length === 0) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const timeouts = [];
    const rawNum = Number(leadTimeMinutes);
    const baseLead = (rawNum === 15 || rawNum === 30 || rawNum === 60) ? rawNum : 10;
    const effectiveLead = baseLead + 1; // 11, 16, 31, 61
    const leadMs = effectiveLead * 60 * 1000;
    const leadText = baseLead === 60 ? '1 hour' : `${baseLead} minutes`;

    const checkAndTriggerReminders = () => {
      const now = Date.now();
      const notifiedEvents = getNotifiedEvents();

      tasks.forEach(task => {
        if (task.status !== 'pending' && task.status !== 'inprogress') return;
        const rawDue = task.dueDateTime || task.due_date_time;
        const taskId = task.id || task._id;
        if (!rawDue || !taskId) return;

        const dueTime = new Date(rawDue).getTime();
        if (isNaN(dueTime)) return;

        // 1. Exact Due Time Reminder (Fires when task reaches due time)
        const dueEventId = `${taskId}_exact_${dueTime}`;
        const timeDiffDue = dueTime - now;

        if (timeDiffDue <= 0 && timeDiffDue >= -120000) {
          // Task due time reached within the last 2 minutes and not yet notified
          if (!notifiedEvents.has(dueEventId)) {
            markEventNotified(dueEventId);
            triggerDesktopNotification(
              `⏰ Task Due: ${task.title}`,
              `Task '${task.title}' (${task.priority || 'Med'} Priority) is due right now!`,
              `dayscore-task-due-${taskId}`
            );
            markTaskNotifiedOnServer(taskId, 'due');
          }
        } else if (timeDiffDue > 0 && timeDiffDue <= 24 * 60 * 60 * 1000) {
          // Future due time: schedule exact-millisecond precision timer
          if (!notifiedEvents.has(dueEventId)) {
            const t = setTimeout(() => {
              markEventNotified(dueEventId);
              triggerDesktopNotification(
                `⏰ Task Due: ${task.title}`,
                `Task '${task.title}' (${task.priority || 'Med'} Priority) is due right now!`,
                `dayscore-task-due-${taskId}`
              );
              markTaskNotifiedOnServer(taskId, 'due');
            }, timeDiffDue);
            timeouts.push(t);
          }
        }

        // 2. Lead Time Reminder (Fires at 11, 16, 31, or 61 min ahead)
        const notifyTime = dueTime - leadMs;
        const leadEventId = `${taskId}_lead_${baseLead}_${notifyTime}`;
        const timeDiffLead = notifyTime - now;

        if (timeDiffLead <= 0 && timeDiffLead >= -120000 && now < dueTime) {
          if (!notifiedEvents.has(leadEventId)) {
            markEventNotified(leadEventId);
            triggerDesktopNotification(
              `⏰ Task Due Soon: ${task.title}`,
              `Task '${task.title}' (${task.priority || 'Med'} Priority) is due in ${leadText}!`,
              `dayscore-task-lead-${taskId}`
            );
            markTaskNotifiedOnServer(taskId, 'lead', baseLead);
          }
        } else if (timeDiffLead > 0 && timeDiffLead <= 24 * 60 * 60 * 1000) {
          if (!notifiedEvents.has(leadEventId)) {
            const t = setTimeout(() => {
              markEventNotified(leadEventId);
              triggerDesktopNotification(
                `⏰ Task Due Soon: ${task.title}`,
                `Task '${task.title}' (${task.priority || 'Med'} Priority) is due in ${leadText}!`,
                `dayscore-task-lead-${taskId}`
              );
              markTaskNotifiedOnServer(taskId, 'lead', baseLead);
            }, timeDiffLead);
            timeouts.push(t);
          }
        }
      });
    };

    checkAndTriggerReminders();
    const interval = setInterval(checkAndTriggerReminders, 10000);

    return () => {
      timeouts.forEach(t => clearTimeout(t));
      clearInterval(interval);
    };
  }, [tasks, enabled, leadTimeMinutes]);

  return { permissionGranted };
}
