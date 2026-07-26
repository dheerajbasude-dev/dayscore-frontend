import { format } from 'date-fns';
import { calculateDailyScore } from './scoring';

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

export function isTasksCached(dateStr) {
  const uid = getUserId();
  return localStorage.getItem(`dayscore_${uid}_tasks_${dateStr}`) !== null;
}

export async function fetchTasksApi(dateStr) {
  const token = getToken();
  if (!token) return getTasks(dateStr);

  try {
    const res = await authFetch(`/api/tasks?date=${dateStr}`);
    if (res.ok) {
      const data = await res.json();
      const serverTasks = (data.tasks || []).map(t => {
        const isClaimed = t.reward_claimed === 1 || t.reward_claimed === '1' || t.reward_claimed === true || t.rewardClaimed === true || t.rewardClaimed === 1;
        const isAcknowledged = t.reward_acknowledged === 1 || t.reward_acknowledged === '1' || t.reward_acknowledged === true || t.rewardAcknowledged === true || t.rewardAcknowledged === 1;
        const isAccepted = t.penalty_accepted === 1 || t.penalty_accepted === '1' || t.penalty_accepted === true || t.penaltyAccepted === true || t.penaltyAccepted === 1;
        const isPenaltyAck = t.penalty_acknowledged === 1 || t.penalty_acknowledged === '1' || t.penalty_acknowledged === true || t.penaltyAcknowledged === true || t.penaltyAcknowledged === 1;
        const isCarried = t.carried_over === 1 || t.carried_over === '1' || t.carried_over === true || t.carriedOver === true || t.carriedOver === 1;

        const createdDate = t.createdAt || t.created_at || new Date().toISOString();
        const completedDate = t.completedAt || t.completed_at || null;

        return {
          ...t,
          id: t.id || t._id,
          _id: t._id || t.id,
          dueDateTime: t.dueDateTime || t.due_date_time,
          due_date_time: t.due_date_time || t.dueDateTime,
          rewardClaimed: isClaimed,
          reward_claimed: isClaimed ? 1 : 0,
          rewardAcknowledged: isAcknowledged,
          reward_acknowledged: isAcknowledged ? 1 : 0,
          penaltyAccepted: isAccepted,
          penalty_accepted: isAccepted ? 1 : 0,
          penaltyAcknowledged: isPenaltyAck,
          penalty_acknowledged: isPenaltyAck ? 1 : 0,
          completedAt: completedDate,
          completed_at: completedDate,
          createdAt: createdDate,
          created_at: createdDate,
          carriedOver: isCarried
        };
      });

      // Directly update local cache with what exists in MongoDB Atlas
      saveTasks(dateStr, serverTasks);
      return serverTasks;
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

export async function addTask(dateStr, task) {
  const token = getToken();
  const tempId = task.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2, 7)));

  if (token) {
    try {
      const res = await authFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          date: dateStr,
          title: task.title || 'Untitled Task',
          category: task.category || 'Work',
          priority: task.priority || 'Med',
          dueDateTime: task.dueDateTime || new Date().toISOString(),
          due_date_time: task.dueDateTime || new Date().toISOString(),
          status: task.status || 'pending',
          carriedOver: !!task.carriedOver,
          reward: task.reward || null,
          penalty: task.penalty || null,
          rating: task.rating ?? null,
          maxRating: task.maxRating ?? null
        })
      });
      if (res.ok) {
        return await fetchTasksApi(dateStr);
      }
    } catch (err) {
      console.error('Add task API error:', err);
    }
  }

  const newTask = {
    id: tempId,
    _id: tempId,
    title: task.title || 'Untitled Task',
    category: task.category || 'Work',
    priority: task.priority || 'Med',
    dueDateTime: task.dueDateTime || new Date().toISOString(),
    due_date_time: task.dueDateTime || new Date().toISOString(),
    status: task.status || 'pending',
    rating: task.rating ?? null,
    maxRating: task.maxRating ?? null,
    reward: task.reward || null,
    penalty: task.penalty || null,
    rewardClaimed: false,
    reward_claimed: 0,
    penaltyAccepted: false,
    penalty_accepted: 0,
    createdAt: new Date().toISOString(),
    carriedOver: !!task.carriedOver,
    ...task
  };

  const tasks = getTasks(dateStr);
  tasks.unshift(newTask);
  saveTasks(dateStr, tasks);
  return newTask;
}

export async function updateTask(dateStr, taskId, updates) {
  const token = getToken();
  const tasks = getTasks(dateStr);
  const existing = tasks.find(t => t.id === taskId || t._id === taskId) || {};
  const targetId = existing.id || existing._id || taskId;

  const cleanUpdates = { ...updates };

  // Enforce mutual exclusion between reward and penalty only when new reward/penalty text is explicitly provided
  if (cleanUpdates.reward) {
    cleanUpdates.penaltyAccepted = false;
    cleanUpdates.penalty_accepted = 0;
    cleanUpdates.penalty = null;
  } else if (cleanUpdates.penalty) {
    cleanUpdates.rewardClaimed = false;
    cleanUpdates.reward_claimed = 0;
    cleanUpdates.reward = null;
  }

  if (token) {
    try {
      const res = await authFetch(`/api/tasks/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify(cleanUpdates)
      });
      if (res.ok) {
        return await fetchTasksApi(dateStr);
      }
    } catch (err) {
      console.error('Update task API error:', err);
    }
  }

  const index = tasks.findIndex(t => t.id === taskId || t._id === taskId);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...cleanUpdates, id: targetId, _id: targetId };
    saveTasks(dateStr, tasks);
  }
  return tasks;
}

export async function deleteTask(dateStr, taskId) {
  const token = getToken();
  if (token) {
    try {
      const res = await authFetch(`/api/tasks/${taskId}?date=${dateStr}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        return await fetchTasksApi(dateStr);
      }
    } catch (err) {
      console.error('Delete task server error:', err);
    }
  }

  const tasks = getTasks(dateStr);
  const newTasks = tasks.filter(t => t.id !== taskId && t._id !== taskId);
  saveTasks(dateStr, newTasks);
  return newTasks;
}

// ==========================================
// Dynamic Archives (Calculated On-The-Fly from Tasks)
// ==========================================

export function getArchivesFromTasks() {
  const uid = getUserId();
  const prefix = `dayscore_${uid}_tasks_`;
  const archiveMap = new Map();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      try {
        const tasks = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(tasks) && tasks.length > 0) {
          const dateStr = key.replace(prefix, '');
          const scoreResult = calculateDailyScore(tasks);
          archiveMap.set(dateStr, {
            date: dateStr,
            score: scoreResult.score,
            tasks
          });
        }
      } catch (e) {}
    }
  }

  return Array.from(archiveMap.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

export function getAllArchives() {
  return getArchivesFromTasks();
}

export function getDayArchive(dateStr) {
  const archives = getArchivesFromTasks();
  return archives.find(a => a.date === dateStr) || null;
}

export function saveDayArchive() {
  // No-op: Archives are calculated dynamically on-the-fly from tasks
}

// ==========================================
// Rewards & Punishments Storage & API
// ==========================================

export function isRewardsCached() {
  const uid = getUserId();
  return localStorage.getItem(`dayscore_${uid}_rewards`) !== null;
}

export function getRewards() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_rewards`);
  return data ? JSON.parse(data) : [];
}

export async function fetchRewardsApi() {
  const token = getToken();
  if (!token) return getRewards();

  try {
    const res = await authFetch('/api/rewards');
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data.rewards) ? data.rewards : [];
      saveRewards(list);
      return list;
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
  const token = getToken();
  if (token) {
    try {
      const res = await authFetch('/api/rewards', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.rewards) ? data.rewards : [];
        saveRewards(list);
        return list;
      }
    } catch (e) {
      console.error('Add reward API error:', e);
    }
  }
  const rewards = getRewards();
  if (!rewards.includes(text)) {
    rewards.push(text);
    saveRewards(rewards);
  }
  return rewards;
}

export async function deleteRewardApi(text) {
  const token = getToken();
  if (token) {
    try {
      const res = await authFetch('/api/rewards', {
        method: 'DELETE',
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.rewards) ? data.rewards : [];
        saveRewards(list);
        return list;
      }
    } catch (e) {
      console.error('Delete reward API error:', e);
    }
  }
  const rewards = getRewards().filter(r => r !== text);
  saveRewards(rewards);
  return rewards;
}

export function getPunishments() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_punishments`);
  return data ? JSON.parse(data) : [];
}

export async function fetchPunishmentsApi() {
  const token = getToken();
  if (!token) return getPunishments();

  try {
    const res = await authFetch('/api/punishments');
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data.punishments) ? data.punishments : [];
      savePunishments(list);
      return list;
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
  const token = getToken();
  if (token) {
    try {
      const res = await authFetch('/api/punishments', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.punishments) ? data.punishments : [];
        savePunishments(list);
        return list;
      }
    } catch (e) {
      console.error('Add punishment API error:', e);
    }
  }
  const punishments = getPunishments();
  if (!punishments.includes(text)) {
    punishments.push(text);
    savePunishments(punishments);
  }
  return punishments;
}

export async function deletePunishmentApi(text) {
  const token = getToken();
  if (token) {
    try {
      const res = await authFetch('/api/punishments', {
        method: 'DELETE',
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.punishments) ? data.punishments : [];
        savePunishments(list);
        return list;
      }
    } catch (e) {
      console.error('Delete punishment API error:', e);
    }
  }
  const punishments = getPunishments().filter(p => p !== text);
  savePunishments(punishments);
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

export function isSettingsCached() {
  const uid = getUserId();
  return localStorage.getItem(`dayscore_${uid}_settings`) !== null;
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
  const fallback = getSettings();
  saveSettings(fallback);
  return fallback;
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


