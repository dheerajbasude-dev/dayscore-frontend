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
          icon: '/favicon.svg',
          badge: '/favicon.svg',
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
        icon: '/favicon.svg',
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

export function useNotifications(tasks, enabled, leadTimeMinutes = 30) {
  const [permissionGranted, setPermissionGranted] = useState(false);

  const checkPermission = useCallback(() => {
    if ('Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [enabled, checkPermission]);

  useEffect(() => {
    if (!enabled || !tasks || tasks.length === 0) return;
    if ('Notification' in window && Notification.permission !== 'granted') return;

    const timeouts = [];
    const notifiedEvents = getNotifiedEvents();

    tasks.forEach(task => {
      if (task.status === 'pending' || task.status === 'inprogress') {
        const rawDue = task.dueDateTime || task.due_date_time;
        const taskId = task.id || task._id;

        if (rawDue && taskId) {
          const dueTime = new Date(rawDue).getTime();
          const now = new Date().getTime();
          
          if (!isNaN(dueTime) && dueTime > now) {
            const leadTimeMs = Number(leadTimeMinutes) * 60 * 1000;
            const notifyTime = dueTime - leadTimeMs;
            const eventId = `${taskId}_${notifyTime}`;
            
            // Skip if this reminder was already triggered during this session
            if (notifiedEvents.has(eventId)) return;

            const timeDiff = notifyTime - now;

            // Only schedule if reminder target time is strictly in the future
            if (timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000) {
              const timeout = setTimeout(() => {
                markEventNotified(eventId);
                const timeMsg = Number(leadTimeMinutes) === 0 
                  ? 'is due right now!' 
                  : `is due in ${leadTimeMinutes} minutes!`;
                
                triggerDesktopNotification(
                  `⏰ Task Due: ${task.title}`,
                  `Task '${task.title}' (${task.priority || 'Med'} Priority) ${timeMsg}`,
                  `dayscore-task-${taskId}`
                );
              }, timeDiff);
              
              timeouts.push(timeout);
            }
          }
        }
      }
    });

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [tasks, enabled, leadTimeMinutes]);

  return { permissionGranted };
}
