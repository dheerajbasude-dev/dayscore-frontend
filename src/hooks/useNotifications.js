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

export async function triggerDesktopNotification(title, body) {
  if (!('Notification' in window)) return false;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') return false;

  // 1. Play single audio chime sound
  playNotificationSound();

  // 2. Direct browser Notification (Instant & Reliable across desktop browsers)
  try {
    const notif = new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: 'dayscore-notif-' + Date.now(),
      requireInteraction: true
    });
    notif.onclick = () => {
      try { window.focus(); } catch (e) {}
      try { notif.close(); } catch (e) {}
    };
    return true;
  } catch (err) {
    console.warn('Standard Notification error:', err);
  }

  // 3. Fallback Service Worker check only if controller exists
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/favicon.svg',
          tag: 'dayscore-notif-' + Date.now()
        });
        return true;
      }
    } catch (err) {
      console.warn('SW showNotification error:', err);
    }
  }

  return false;
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

    const timeouts = [];

    tasks.forEach(task => {
      if (task.status === 'pending' || task.status === 'inprogress') {
        const rawDue = task.dueDateTime || task.due_date_time;
        if (rawDue) {
          const dueTime = new Date(rawDue).getTime();
          const now = new Date().getTime();
          
          if (!isNaN(dueTime)) {
            const leadTimeMs = Number(leadTimeMinutes) * 60 * 1000;
            const notifyTime = dueTime - leadTimeMs;
            
            if (notifyTime > now) {
              const timeout = setTimeout(() => {
                const timeMsg = Number(leadTimeMinutes) === 0 ? 'is due right now!' : `is due in ${leadTimeMinutes} minutes!`;
                triggerDesktopNotification(`⏰ Task Due: ${task.title}`, `Task '${task.title}' (${task.priority} Priority) ${timeMsg}`);
              }, notifyTime - now);
              
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
