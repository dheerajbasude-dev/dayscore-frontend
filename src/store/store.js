import { format } from 'date-fns';

export const getDateKey = (date) => format(date || new Date(), 'yyyy-MM-dd');

const getToken = () => localStorage.getItem('dayscore_token');

export const getUserId = () => {
  const token = getToken();
  if (!token) return 'guest';
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const parsed = JSON.parse(jsonPayload);
    return parsed.id || 'guest';
  } catch (e) {
    return 'guest';
  }
};

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const authFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${cleanPath}`;
  return fetch(fullUrl, { ...options, headers });
};

// ==========================================
// Tasks Storage & API
// ==========================================

export function getTasks(dateStr) {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_tasks_${dateStr}`);
  return data ? JSON.parse(data) : [];
}

export async function fetchTasksApi(dateStr) {
  const token = getToken();
  if (!token) return getTasks(dateStr);

  try {
    const res = await authFetch(`/api/tasks?date=${dateStr}`);
    if (res.ok) {
      const data = await res.json();
      const uid = getUserId();
      localStorage.setItem(`dayscore_${uid}_tasks_${dateStr}`, JSON.stringify(data.tasks));
      return data.tasks;
    }
  } catch (e) {
    console.warn('Failed to fetch tasks from server:', e);
  }
  return getTasks(dateStr);
}

export function saveTasks(dateStr, tasks) {
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_tasks_${dateStr}`, JSON.stringify(tasks));
}

export function addTask(dateStr, task) {
  const token = getToken();
  const newTask = {
    id: task.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2, 7))),
    title: task.title || 'Untitled Task',
    category: task.category || 'Work',
    priority: task.priority || 'Med',
    dueDateTime: task.dueDateTime || new Date().toISOString(),
    status: task.status || 'pending',
    rating: task.rating ?? null,
    maxRating: task.maxRating ?? null,
    createdAt: new Date().toISOString(),
    carriedOver: !!task.carriedOver,
    ...task
  };

  const tasks = getTasks(dateStr);
  tasks.unshift(newTask);
  saveTasks(dateStr, tasks);

  if (token) {
    authFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        date: dateStr,
        title: newTask.title,
        category: newTask.category,
        priority: newTask.priority,
        dueDateTime: newTask.dueDateTime,
        status: newTask.status,
        carriedOver: newTask.carriedOver
      })
    }).then(res => {
      if (!res.ok) return null;
      return res.json();
    }).then(data => {
      if (data && data.task && data.task.id) {
        // Update local task with server assigned ID if changed
        const currentTasks = getTasks(dateStr);
        const idx = currentTasks.findIndex(t => t.id === newTask.id);
        if (idx !== -1) {
          currentTasks[idx].id = data.task.id;
          saveTasks(dateStr, currentTasks);
        }
      }
    }).catch(err => console.error('Add task API error:', err));
  }

  return newTask;
}

export function updateTask(dateStr, taskId, updates) {
  const tasks = getTasks(dateStr);
  const index = tasks.findIndex(t => t.id === taskId);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updates };
    saveTasks(dateStr, tasks);

    const token = getToken();
    if (token) {
      authFetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }).catch(err => console.error('Update task API error:', err));
    }
  }
}

export function deleteTask(dateStr, taskId) {
  const tasks = getTasks(dateStr);
  const newTasks = tasks.filter(t => t.id !== taskId);
  saveTasks(dateStr, newTasks);

  const token = getToken();
  if (token) {
    authFetch(`/api/tasks/${taskId}?date=${dateStr}`, {
      method: 'DELETE'
    }).catch(err => console.error('Delete task API error:', err));
  }
}

// ==========================================
// Day Archives Storage & API
// ==========================================

export function getDayArchive(dateStr) {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_archive_${dateStr}`);
  return data ? JSON.parse(data) : null;
}

export function saveDayArchive(dateStr, data) {
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_archive_${dateStr}`, JSON.stringify(data));

  const token = getToken();
  if (token) {
    authFetch('/api/archives', {
      method: 'POST',
      body: JSON.stringify({ date: dateStr, ...data })
    }).catch(err => console.error('Save archive API error:', err));
  }
}

export function getAllArchives() {
  const uid = getUserId();
  const prefix = `dayscore_${uid}_archive_`;
  const archives = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (item && typeof item === 'object') {
          const dateFromKey = key.replace(prefix, '');
          if (!item.date || typeof item.date !== 'string') {
            item.date = dateFromKey;
          }
          archives.push(item);
        }
      } catch (e) {
        console.error('Failed to parse archive key:', key, e);
      }
    }
  }
  return archives.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

export async function fetchArchivesApi() {
  const token = getToken();
  if (!token) return getAllArchives();

  try {
    const res = await authFetch('/api/archives');
    if (res.ok) {
      const data = await res.json();
      const uid = getUserId();
      data.archives.forEach(arc => {
        localStorage.setItem(`dayscore_${uid}_archive_${arc.date}`, JSON.stringify(arc));
      });
      return data.archives;
    }
  } catch (e) {
    console.warn('Failed to fetch archives from API:', e);
  }
  return getAllArchives();
}

// ==========================================
// Rewards & Punishments Storage & API
// ==========================================

export function getRewards() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_rewards`);
  return data ? JSON.parse(data) : [
    '30 mins video gaming 🎮',
    'Favorite dessert 🍕',
    'Watch a movie / show 🎬',
    'Guilt-free relaxation ☕',
    'Sleep in tomorrow 😴'
  ];
}

export async function fetchRewardsApi() {
  const token = getToken();
  if (!token) return getRewards();

  try {
    const res = await authFetch('/api/rewards');
    if (res.ok) {
      const data = await res.json();
      saveRewards(data.rewards);
      return data.rewards;
    }
  } catch (e) {
    console.warn('Fetch rewards API error:', e);
  }
  return getRewards();
}

export function saveRewards(rewards) {
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_rewards`, JSON.stringify(rewards));
}

export async function addRewardApi(text) {
  const rewards = getRewards();
  if (!rewards.includes(text)) {
    rewards.push(text);
    saveRewards(rewards);
  }

  const token = getToken();
  if (token) {
    try {
      const res = await authFetch('/api/rewards', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        saveRewards(data.rewards);
        return data.rewards;
      }
    } catch (e) {
      console.error('Add reward API error:', e);
    }
  }
  return rewards;
}

export async function deleteRewardApi(text) {
  const rewards = getRewards().filter(r => r !== text);
  saveRewards(rewards);

  const token = getToken();
  if (token) {
    try {
      const res = await authFetch('/api/rewards', {
        method: 'DELETE',
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        saveRewards(data.rewards);
        return data.rewards;
      }
    } catch (e) {
      console.error('Delete reward API error:', e);
    }
  }
  return rewards;
}

export function getPunishments() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_punishments`);
  return data ? JSON.parse(data) : [
    'No social media for 24h 📵',
    'Cold shower tomorrow 🚿',
    '20 extra pushups 💪',
    'No YouTube for a day 📺',
    'Donate $5 to charity 💸'
  ];
}

export async function fetchPunishmentsApi() {
  const token = getToken();
  if (!token) return getPunishments();

  try {
    const res = await authFetch('/api/punishments');
    if (res.ok) {
      const data = await res.json();
      savePunishments(data.punishments);
      return data.punishments;
    }
  } catch (e) {
    console.warn('Fetch punishments API error:', e);
  }
  return getPunishments();
}

export function savePunishments(punishments) {
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_punishments`, JSON.stringify(punishments));
}

export async function addPunishmentApi(text) {
  const punishments = getPunishments();
  if (!punishments.includes(text)) {
    punishments.push(text);
    savePunishments(punishments);
  }

  const token = getToken();
  if (token) {
    try {
      const res = await authFetch('/api/punishments', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        savePunishments(data.punishments);
        return data.punishments;
      }
    } catch (e) {
      console.error('Add punishment API error:', e);
    }
  }
  return punishments;
}

export async function deletePunishmentApi(text) {
  const punishments = getPunishments().filter(p => p !== text);
  savePunishments(punishments);

  const token = getToken();
  if (token) {
    try {
      const res = await authFetch('/api/punishments', {
        method: 'DELETE',
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        savePunishments(data.punishments);
        return data.punishments;
      }
    } catch (e) {
      console.error('Delete punishment API error:', e);
    }
  }
  return punishments;
}

export function getActivePunishment() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_active_punishment`);
  return data ? JSON.parse(data) : null;
}

export function setActivePunishment(text) {
  const uid = getUserId();
  const val = typeof text === 'string' ? { text, acknowledged: false } : text;
  localStorage.setItem(`dayscore_${uid}_active_punishment`, JSON.stringify(val));
}

export function acknowledgePunishment() {
  const active = getActivePunishment();
  if (active) {
    const uid = getUserId();
    active.acknowledged = true;
    localStorage.setItem(`dayscore_${uid}_active_punishment`, JSON.stringify(active));
  }
}

export function getStreakMilestoneRewards() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_streak_milestones`);
  return data ? JSON.parse(data) : { 7: '', 14: '', 30: '', 100: '' };
}

export function saveStreakMilestoneRewards(milestones) {
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_streak_milestones`, JSON.stringify(milestones));
}

export function getTemplates() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_templates`);
  return data ? JSON.parse(data) : [];
}

export function saveTemplates(templates) {
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_templates`, JSON.stringify(templates));
}

export function getSettings() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_settings`);
  const defaults = { theme: 'dark', notifications: false, reminderLeadTime: 30 };
  return data ? { ...defaults, ...JSON.parse(data) } : defaults;
}

export async function fetchSettingsApi() {
  const token = getToken();
  if (!token) return getSettings();

  try {
    const res = await authFetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      const current = getSettings();
      const updated = { ...current, ...data.settings };
      saveSettings(updated);
      return updated;
    }
  } catch (e) {
    console.warn('Fetch settings API error:', e);
  }
  return getSettings();
}

export function saveSettings(settings) {
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_settings`, JSON.stringify(settings));

  const token = getToken();
  if (token) {
    authFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }).catch(err => console.error('Save settings API error:', err));
  }
}

export function exportAllData() {
  const uid = getUserId();
  const prefix = `dayscore_${uid}_`;
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      data[key] = localStorage.getItem(key);
    }
  }
  return JSON.stringify(data);
}

export function importAllData(jsonString) {
  try {
    const uid = getUserId();
    const data = JSON.parse(jsonString);
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('dayscore_')) {
        const cleanKey = key.replace(/^dayscore_([^_]+_)?/, `dayscore_${uid}_`);
        localStorage.setItem(cleanKey, value);
      }
    }
    return { success: true, message: 'Data imported successfully' };
  } catch (error) {
    return { success: false, message: 'Invalid data format' };
  }
}

export function resetAllData() {
  const uid = getUserId();
  const prefix = `dayscore_${uid}_`;
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

export function getClaimsHistory() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_claims_history`);
  return data ? JSON.parse(data) : [];
}

export function logClaim({ type, text, date }) {
  const history = getClaimsHistory();
  const newEntry = {
    id: Date.now().toString(),
    type,
    text,
    date: date || new Date().toISOString().split('T')[0],
    claimedAt: new Date().toISOString()
  };
  history.unshift(newEntry);
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_claims_history`, JSON.stringify(history));

  const token = getToken();
  if (token) {
    authFetch('/api/claims', {
      method: 'POST',
      body: JSON.stringify(newEntry)
    }).catch(err => console.error('Log claim API error:', err));
  }
  return newEntry;
}

export function deleteClaim(id) {
  const history = getClaimsHistory();
  const updated = history.filter(item => item.id !== id);
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_claims_history`, JSON.stringify(updated));
}
