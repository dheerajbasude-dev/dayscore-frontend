import { format, parseISO } from 'date-fns';
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
  const cleanDate = dateStr ? (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim().substring(0, 10)) : format(new Date(), 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const data = localStorage.getItem(`dayscore_${uid}_tasks_${cleanDate}`);
  let tasks = data ? JSON.parse(data) : [];

  if (cleanDate === todayStr) {
    const prefix = `dayscore_${uid}_tasks_`;
    const pastCarried = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && key !== `dayscore_${uid}_tasks_${todayStr}`) {
        const pastDate = key.replace(prefix, '');
        if (pastDate < todayStr) {
          try {
            const pastList = JSON.parse(localStorage.getItem(key)) || [];
            pastList.forEach(t => {
              if (t.status !== 'done') {
                const dueIso = t.dueDateTime || t.due_date_time;
                let shouldCarry = true;
                if (dueIso) {
                  try {
                    const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
                    const dueDateStr = format(dueObj, 'yyyy-MM-dd');
                    if (dueDateStr < todayStr) shouldCarry = false;
                  } catch (e) {}
                }
                if (shouldCarry) {
                  pastCarried.push({
                    ...t,
                    date: todayStr,
                    status: t.status === 'done' ? 'done' : 'pending',
                    carriedOver: true,
                    carried_over: 1,
                    originalDate: t.originalDate || t.original_date || pastDate,
                    original_date: t.originalDate || t.original_date || pastDate
                  });
                }
              }
            });
          } catch (e) {}
        }
      }
    }

    if (pastCarried.length > 0) {
      const existingIds = new Set(tasks.map(t => String(t.id || t._id)));
      let added = false;
      pastCarried.forEach(pt => {
        const pid = String(pt.id || pt._id);
        if (!existingIds.has(pid)) {
          tasks.push(pt);
          existingIds.add(pid);
          added = true;
        }
      });
      if (added) {
        localStorage.setItem(`dayscore_${uid}_tasks_${cleanDate}`, JSON.stringify(tasks));
      }
    }
  }

  return tasks;
}

export function isTasksCached(dateStr) {
  const uid = getUserId();
  const cleanDate = dateStr ? (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim().substring(0, 10)) : format(new Date(), 'yyyy-MM-dd');
  return localStorage.getItem(`dayscore_${uid}_tasks_${cleanDate}`) !== null;
}

export function formatServerTask(t) {
  const isClaimed = t.reward_claimed === 1 || t.reward_claimed === '1' || t.reward_claimed === true || t.rewardClaimed === true || t.rewardClaimed === 1;
  const isAcknowledged = t.reward_acknowledged === 1 || t.reward_acknowledged === '1' || t.reward_acknowledged === true || t.rewardAcknowledged === true || t.rewardAcknowledged === 1;
  const isAccepted = t.penalty_accepted === 1 || t.penalty_accepted === '1' || t.penalty_accepted === true || t.penaltyAccepted === true || t.penaltyAccepted === 1;
  const isPenaltyAck = t.penalty_acknowledged === 1 || t.penalty_acknowledged === '1' || t.penalty_acknowledged === true || t.penaltyAcknowledged === true || t.penaltyAcknowledged === 1;
  const isCarried = t.carried_over === 1 || t.carried_over === '1' || t.carried_over === true || t.carriedOver === true || t.carriedOver === 1;

  const createdDate = t.createdAt || t.created_at || new Date().toISOString();
  const completedDate = t.completedAt || t.completed_at || null;

  let taskDate = t.date;
  if (taskDate && typeof taskDate === 'string' && taskDate.includes('T')) {
    taskDate = taskDate.split('T')[0];
  }
  const dueIso = t.dueDateTime || t.due_date_time;
  if (dueIso && (t.status === 'missed' || t.status === 'done' || t.completed === true)) {
    try {
      const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
      const dueStr = format(dueObj, 'yyyy-MM-dd');
      if (dueStr) taskDate = dueStr;
    } catch (e) {}
  }
  if (!taskDate && createdDate) {
    taskDate = typeof createdDate === 'string' ? createdDate.substring(0, 10) : format(new Date(), 'yyyy-MM-dd');
  }
  if (!taskDate || typeof taskDate !== 'string' || taskDate.length < 10) {
    taskDate = format(new Date(), 'yyyy-MM-dd');
  }
  taskDate = taskDate.trim().substring(0, 10);

  return {
    ...t,
    id: t.id || t._id,
    _id: t._id || t.id,
    date: taskDate,
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
}

export async function fetchTasksApi(dateStr) {
  const token = getToken();
  const cleanDate = dateStr ? (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim().substring(0, 10)) : format(new Date(), 'yyyy-MM-dd');
  if (!token) return getTasks(cleanDate);

  try {
    const res = await authFetch(`/api/tasks?date=${cleanDate}`);
    if (res.ok) {
      const data = await res.json();
      const serverTasks = (data.tasks || []).map(formatServerTask);

      // Directly update local cache with what exists in MongoDB Atlas
      saveTasks(cleanDate, serverTasks);
      return serverTasks;
    }
  } catch (e) {
    console.warn('Failed to fetch tasks from server:', e);
  }
  return getTasks(cleanDate);
}

export async function fetchAllTasksApi() {
  const token = getToken();
  if (!token) return getArchivesFromTasks();

  try {
    const res = await authFetch('/api/tasks');
    if (res.ok) {
      const data = await res.json();
      const serverTasks = (data.tasks || []).map(formatServerTask);
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const tasksByDate = new Map();
      serverTasks.forEach(t => {
        const d = t.date || todayStr;
        if (!tasksByDate.has(d)) {
          tasksByDate.set(d, []);
        }
        tasksByDate.get(d).push(t);
      });

      // Synchronously assign carried-over tasks to todayStr
      tasksByDate.forEach((tasksList, d) => {
        if (d < todayStr) {
          tasksList.forEach(t => {
            if (t.status !== 'done') {
              const dueIso = t.dueDateTime || t.due_date_time;
              let shouldCarry = true;
              if (dueIso) {
                try {
                  const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
                  const dueDateStr = format(dueObj, 'yyyy-MM-dd');
                  if (dueDateStr < todayStr) shouldCarry = false;
                } catch (e) {}
              }
              if (shouldCarry) {
                if (!tasksByDate.has(todayStr)) {
                  tasksByDate.set(todayStr, []);
                }
                const todayList = tasksByDate.get(todayStr);
                const exists = todayList.some(existing => String(existing.id || existing._id) === String(t.id || t._id));
                if (!exists) {
                  todayList.push({
                    ...t,
                    date: todayStr,
                    status: t.status === 'done' ? 'done' : 'pending',
                    carriedOver: true,
                    carried_over: 1,
                    originalDate: t.originalDate || t.original_date || d,
                    original_date: t.originalDate || t.original_date || d
                  });
                }
              }
            }
          });
        }
      });

      // Clear local task cache for this user to remove stale/guest/un-synced items
      const uid = getUserId();
      const prefix = `dayscore_${uid}_tasks_`;
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Save fresh tasks per date
      tasksByDate.forEach((tasks, dateStr) => {
        saveTasks(dateStr, tasks);
      });

      return getArchivesFromTasks();
    }
  } catch (e) {
    console.warn('Failed to fetch all tasks from server:', e);
  }
  return getArchivesFromTasks();
}

export function saveTasks(dateStr, tasks) {
  const uid = getUserId();
  const cleanDate = dateStr ? (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim().substring(0, 10)) : format(new Date(), 'yyyy-MM-dd');
  localStorage.setItem(`dayscore_${uid}_tasks_${cleanDate}`, JSON.stringify(tasks));
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
        await fetchAllTasksApi();
        return getTasks(dateStr);
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

  if (existing.status === 'missed') {
    if (cleanUpdates.status === 'done') {
      cleanUpdates.wasMissed = true;
      cleanUpdates.was_missed = 1;
      if (cleanUpdates.rating !== undefined && cleanUpdates.rating !== null) {
        cleanUpdates.rating = Math.min(Number(cleanUpdates.rating) || 1, 3);
      }
    }
  }

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
        await fetchAllTasksApi();
        return getTasks(dateStr);
      }
    } catch (err) {
      console.error('Update task API error:', err);
    }
  }

  if (cleanUpdates.date && cleanUpdates.date !== dateStr) {
    const oldTasks = getTasks(dateStr).filter(t => t.id !== targetId && t._id !== targetId);
    saveTasks(dateStr, oldTasks);

    const newTasks = getTasks(cleanUpdates.date);
    const existingIdx = newTasks.findIndex(t => t.id === targetId || t._id === targetId);
    const updatedTaskObj = { ...existing, ...cleanUpdates, id: targetId, _id: targetId, date: cleanUpdates.date };
    if (existingIdx !== -1) {
      newTasks[existingIdx] = updatedTaskObj;
    } else {
      newTasks.push(updatedTaskObj);
    }
    saveTasks(cleanUpdates.date, newTasks);
  } else {
    const index = tasks.findIndex(t => t.id === taskId || t._id === taskId);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...cleanUpdates, id: targetId, _id: targetId };
      saveTasks(dateStr, tasks);
    }
  }
  return getTasks(dateStr);
}

export async function deleteTask(dateStr, taskId) {
  const token = getToken();
  if (token) {
    try {
      const res = await authFetch(`/api/tasks/${taskId}?date=${dateStr}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchAllTasksApi();
        return getTasks(dateStr);
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
          let dateStr = key.replace(prefix, '');
          if (dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
          }
          dateStr = dateStr.trim().substring(0, 10);

          const scoreResult = calculateDailyScore(tasks);
          const hasDone = tasks.some(t => t && (t.status === 'done' || t.completedAt || t.completed_at));
          archiveMap.set(dateStr, {
            date: dateStr,
            score: scoreResult.score,
            hasDone,
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
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
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
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed === 'string') {
      return { text: parsed, acknowledged: false };
    }
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return { text: String(parsed), acknowledged: false };
  } catch (e) {
    return { text: data, acknowledged: false };
  }
}

export function setActivePunishment(text) {
  const uid = getUserId();
  if (!text) {
    localStorage.removeItem(`dayscore_${uid}_active_punishment`);
    return;
  }
  const val = typeof text === 'string' 
    ? { text, acknowledged: false } 
    : (text && typeof text === 'object' ? { acknowledged: false, ...text } : { text: String(text), acknowledged: false });
  localStorage.setItem(`dayscore_${uid}_active_punishment`, JSON.stringify(val));
}

export function acknowledgePunishment() {
  const uid = getUserId();
  const active = getActivePunishment();
  if (active && typeof active === 'object') {
    active.acknowledged = true;
    localStorage.setItem(`dayscore_${uid}_active_punishment`, JSON.stringify(active));
  } else {
    localStorage.removeItem(`dayscore_${uid}_active_punishment`);
  }
}

export function getStreakMilestoneRewards() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_streak_milestones`);
  return data ? JSON.parse(data) : { 7: '', 14: '', 30: '', 100: '' };
}

export function getClaimedStreakMilestones() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_claimed_streak_milestones`);
  return data ? JSON.parse(data) : { 7: false, 14: false, 30: false, 100: false };
}

export function saveStreakMilestoneRewards(milestones, claimed = null) {
  const uid = getUserId();
  if (milestones) {
    localStorage.setItem(`dayscore_${uid}_streak_milestones`, JSON.stringify(milestones));
  }
  if (claimed) {
    localStorage.setItem(`dayscore_${uid}_claimed_streak_milestones`, JSON.stringify(claimed));
  }
}

export async function fetchStreakMilestonesApi() {
  const token = getToken();
  if (!token) {
    return {
      milestones: getStreakMilestoneRewards(),
      claimed: getClaimedStreakMilestones()
    };
  }

  try {
    const res = await authFetch('/api/streak-milestones');
    if (res.ok) {
      const data = await res.json();
      const milestones = data.milestones || { 7: '', 14: '', 30: '', 100: '' };
      const claimed = data.claimed_milestones || { 7: false, 14: false, 30: false, 100: false };
      saveStreakMilestoneRewards(milestones, claimed);
      return { milestones, claimed };
    }
  } catch (e) {
    console.warn('Fetch streak milestones API error:', e);
  }

  return {
    milestones: getStreakMilestoneRewards(),
    claimed: getClaimedStreakMilestones()
  };
}

export async function saveStreakMilestonesApi(milestones) {
  saveStreakMilestoneRewards(milestones);
  const token = getToken();
  if (!token) return milestones;

  try {
    let res = await authFetch('/api/streak-milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestones })
    });
    if (!res || !res.ok) {
      res = await authFetch('/api/streak-milestones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestones })
      });
    }
    if (res && res.ok) {
      const data = await res.json();
      const updatedMilestones = data.milestones || milestones;
      const updatedClaimed = data.claimed_milestones || null;
      saveStreakMilestoneRewards(updatedMilestones, updatedClaimed);
      return updatedMilestones;
    }
  } catch (e) {
    console.warn('Save streak milestones API warning:', e);
  }

  return milestones;
}

export async function claimStreakMilestoneApi(days) {
  const currentClaimed = getClaimedStreakMilestones();
  currentClaimed[days] = true;
  saveStreakMilestoneRewards(getStreakMilestoneRewards(), currentClaimed);

  const token = getToken();
  if (!token) return currentClaimed;

  try {
    const res = await authFetch('/api/streak-milestones/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days })
    });
    if (res.ok) {
      const data = await res.json();
      const updatedClaimed = data.claimed_milestones || currentClaimed;
      saveStreakMilestoneRewards(data.milestones || getStreakMilestoneRewards(), updatedClaimed);
      return updatedClaimed;
    }
  } catch (e) {
    console.error('Claim streak milestone API error:', e);
  }

  return currentClaimed;
}

export const DEFAULT_TEMPLATES = [
  { id: 'default-1', title: 'Work Sync & Sprint Update', category: 'Work', priority: 'High', relativeTime: '10:00' },
  { id: 'default-2', title: 'Code Review & PR Polish', category: 'Work', priority: 'Med', relativeTime: '14:00' },
  { id: 'default-3', title: 'Learning & Skill Practice', category: 'Learning', priority: 'Med', relativeTime: '16:00' },
  { id: 'default-4', title: 'Workout & Fitness Session', category: 'Health', priority: 'High', relativeTime: '18:00' }
];

export function getTemplates() {
  const uid = getUserId();
  const data = localStorage.getItem(`dayscore_${uid}_templates`);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.warn('Parse templates error:', e);
    }
  }
  return DEFAULT_TEMPLATES;
}

export function saveTemplates(templates) {
  const uid = getUserId();
  localStorage.setItem(`dayscore_${uid}_templates`, JSON.stringify(templates));
}

export async function fetchTemplatesApi() {
  const token = getToken();
  if (!token) return getTemplates();

  try {
    const res = await authFetch('/api/templates');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.templates)) {
        saveTemplates(data.templates);
        return data.templates;
      }
    }
  } catch (e) {
    console.warn('Fetch templates API error:', e);
  }
  return getTemplates();
}

export async function saveTemplateApi(templateData) {
  const token = getToken();
  if (!token) {
    const current = getTemplates();
    let updated;
    if (templateData.id) {
      updated = current.map(t => t.id === templateData.id ? { ...t, ...templateData } : t);
    } else {
      const newT = { ...templateData, id: Date.now().toString() };
      updated = [...current, newT];
    }
    saveTemplates(updated);
    return updated;
  }

  try {
    const isEdit = Boolean(templateData.id);
    const url = isEdit ? `/api/templates/${templateData.id}` : '/api/templates';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await authFetch(url, {
      method,
      body: JSON.stringify(templateData)
    });

    if (res.ok) {
      const data = await res.json();
      const saved = data.template;
      const current = getTemplates();
      let updated;
      if (isEdit) {
        updated = current.map(t => t.id === saved.id ? saved : t);
      } else {
        updated = [saved, ...current.filter(t => t.id !== saved.id)];
      }
      saveTemplates(updated);
      return updated;
    }
  } catch (e) {
    console.error('Save template API error:', e);
  }

  const current = getTemplates();
  let updated;
  if (templateData.id) {
    updated = current.map(t => t.id === templateData.id ? { ...t, ...templateData } : t);
  } else {
    const newT = { ...templateData, id: Date.now().toString() };
    updated = [...current, newT];
  }
  saveTemplates(updated);
  return updated;
}

export async function deleteTemplateApi(id) {
  const current = getTemplates().filter(t => t.id !== id);
  saveTemplates(current);

  const token = getToken();
  if (token) {
    try {
      await authFetch(`/api/templates/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Delete template API error:', e);
    }
  }
  return current;
}

// ==========================================
// Daily Reflections Storage & API Sync
// ==========================================

export function getReflection(date) {
  const uid = getUserId();
  return localStorage.getItem(`dayscore_${uid}_reflection_${date}`) || '';
}

export function saveReflection(date, content) {
  const uid = getUserId();
  if (content) {
    localStorage.setItem(`dayscore_${uid}_reflection_${date}`, content);
  } else {
    localStorage.removeItem(`dayscore_${uid}_reflection_${date}`);
  }

  const token = getToken();
  if (token) {
    authFetch(`/api/reflections/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ content: content || '' })
    }).catch(err => console.error('Save reflection API error:', err));
  }
}

export async function fetchReflectionApi(date) {
  const token = getToken();
  if (!token) return getReflection(date);

  try {
    const res = await authFetch(`/api/reflections/${date}`);
    if (res.ok) {
      const data = await res.json();
      const content = data.reflection ? data.reflection.content : '';
      const uid = getUserId();
      if (content) {
        localStorage.setItem(`dayscore_${uid}_reflection_${date}`, content);
      } else {
        localStorage.removeItem(`dayscore_${uid}_reflection_${date}`);
      }
      return content;
    }
  } catch (e) {
    console.warn('Fetch reflection API error:', e);
  }
  return getReflection(date);
}

export async function deleteReflectionApi(date) {
  const uid = getUserId();
  localStorage.removeItem(`dayscore_${uid}_reflection_${date}`);

  const token = getToken();
  if (token) {
    try {
      await authFetch(`/api/reflections/${date}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Delete reflection API error:', e);
    }
  }
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


