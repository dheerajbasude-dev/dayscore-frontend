import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File path for JSON fallback / Vercel serverless persistence
const jsonDbPath = process.env.VERCEL ? join(os.tmpdir(), 'dayscore_db.json') : join(__dirname, 'dayscore_db.json');

// In-memory data store structure
let storeData = {
  users: [],
  tasks: [],
  day_archives: [],
  user_rewards: [],
  user_punishments: [],
  claims_log: [],
  user_settings: []
};

// Load JSON file into memory
const loadJsonData = () => {
  try {
    if (fs.existsSync(jsonDbPath)) {
      const content = fs.readFileSync(jsonDbPath, 'utf8');
      if (content.trim()) {
        const parsed = JSON.parse(content);
        storeData = {
          users: parsed.users || [],
          tasks: parsed.tasks || [],
          day_archives: parsed.day_archives || [],
          user_rewards: parsed.user_rewards || [],
          user_punishments: parsed.user_punishments || [],
          claims_log: parsed.claims_log || [],
          user_settings: parsed.user_settings || []
        };
      }
    }
  } catch (e) {
    console.warn('Error loading JSON DB file, starting with fresh store:', e.message);
  }
};

// Save in-memory store to JSON file
const saveJsonData = () => {
  try {
    fs.writeFileSync(jsonDbPath, JSON.stringify(storeData, null, 2), 'utf8');
  } catch (e) {
    console.warn('Error saving JSON DB file:', e.message);
  }
};

// Initialize schema
export const initDb = async () => {
  loadJsonData();
  console.log('Database initialized successfully.');
};

let dbInitPromise = null;
export const ensureDbInitialized = () => {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch(err => {
      console.error('Database initialization error:', err);
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
};

// Pure-JS SQL Query Processor
export const run = async (sql, params = []) => {
  await ensureDbInitialized();
  const trimmed = sql.trim();

  // USERS
  if (trimmed.startsWith('INSERT INTO users')) {
    const [id, email, password_hash, name, created_at] = params;
    storeData.users = storeData.users.filter(u => u.email !== email);
    storeData.users.push({ id, email, password_hash, name, created_at });
    saveJsonData();
    return { lastID: id, changes: 1 };
  }

  // TASKS
  if (trimmed.startsWith('INSERT INTO tasks')) {
    const [id, user_id, date, title, category, priority, status, due_date_time, carried_over, created_at] = params;
    storeData.tasks.unshift({
      id, user_id, date, title, category, priority, status,
      due_date_time, rating: null, max_rating: null, reward: null, penalty: null,
      reward_claimed: 0, penalty_accepted: 0, carried_over: carried_over ? 1 : 0,
      completed_at: null, created_at
    });
    saveJsonData();
    return { lastID: id, changes: 1 };
  }

  if (trimmed.startsWith('UPDATE tasks SET')) {
    const [title, category, priority, status, due_date_time, rating, max_rating, reward, penalty, reward_claimed, penalty_accepted, completed_at, id, user_id] = params;
    let task = storeData.tasks.find(t => t.id === id && t.user_id === user_id);
    if (!task) {
      task = {
        id, user_id, date: new Date().toISOString().substring(0, 10), title: title || 'Task', category: category || 'Work',
        priority: priority || 'Med', status: status || 'pending', due_date_time: due_date_time || null,
        rating: null, max_rating: null, reward: null, penalty: null, reward_claimed: 0, penalty_accepted: 0,
        carried_over: 0, completed_at: null, created_at: new Date().toISOString()
      };
      storeData.tasks.unshift(task);
    }
    task.title = title;
    task.category = category;
    task.priority = priority;
    task.status = status;
    task.due_date_time = due_date_time;
    task.rating = rating;
    task.max_rating = max_rating;
    task.reward = reward;
    task.penalty = penalty;
    task.reward_claimed = reward_claimed;
    task.penalty_accepted = penalty_accepted;
    task.completed_at = completed_at;
    saveJsonData();
    return { changes: 1 };
  }

  if (trimmed.startsWith('DELETE FROM tasks')) {
    const [id, user_id] = params;
    const initialLen = storeData.tasks.length;
    storeData.tasks = storeData.tasks.filter(t => !(t.id === id && t.user_id === user_id));
    saveJsonData();
    return { changes: initialLen - storeData.tasks.length };
  }

  // DAY ARCHIVES
  if (trimmed.startsWith('UPDATE day_archives SET')) {
    const [score, reflection, reward, reward_acknowledged, id, user_id] = params;
    const arc = storeData.day_archives.find(a => a.id === id && a.user_id === user_id);
    if (arc) {
      if (score !== null) arc.score = score;
      if (reflection !== null) arc.reflection = reflection;
      if (reward !== null) arc.reward = reward;
      if (reward_acknowledged !== null) arc.reward_acknowledged = reward_acknowledged;
      saveJsonData();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  if (trimmed.startsWith('INSERT INTO day_archives')) {
    const [id, user_id, date, score, reflection, reward, reward_acknowledged, created_at] = params;
    storeData.day_archives = storeData.day_archives.filter(a => !(a.user_id === user_id && a.date === date));
    storeData.day_archives.push({ id, user_id, date, score, reflection, reward, reward_acknowledged, created_at });
    saveJsonData();
    return { lastID: id, changes: 1 };
  }

  // USER REWARDS
  if (trimmed.startsWith('INSERT INTO user_rewards')) {
    const [id, user_id, text, created_at] = params;
    storeData.user_rewards.push({ id, user_id, text, created_at });
    saveJsonData();
    return { lastID: id, changes: 1 };
  }

  if (trimmed.startsWith('DELETE FROM user_rewards')) {
    const [user_id, text] = params;
    const initialLen = storeData.user_rewards.length;
    storeData.user_rewards = storeData.user_rewards.filter(r => !(r.user_id === user_id && r.text === text));
    saveJsonData();
    return { changes: initialLen - storeData.user_rewards.length };
  }

  // USER PUNISHMENTS
  if (trimmed.startsWith('INSERT INTO user_punishments')) {
    const [id, user_id, text, created_at] = params;
    storeData.user_punishments.push({ id, user_id, text, acknowledged: 0, created_at });
    saveJsonData();
    return { lastID: id, changes: 1 };
  }

  if (trimmed.startsWith('DELETE FROM user_punishments')) {
    const [user_id, text] = params;
    const initialLen = storeData.user_punishments.length;
    storeData.user_punishments = storeData.user_punishments.filter(p => !(p.user_id === user_id && p.text === text));
    saveJsonData();
    return { changes: initialLen - storeData.user_punishments.length };
  }

  // CLAIMS LOG
  if (trimmed.startsWith('INSERT INTO claims_log')) {
    const [id, user_id, type, text, date, created_at] = params;
    storeData.claims_log.unshift({ id, user_id, type, text, date, created_at });
    saveJsonData();
    return { lastID: id, changes: 1 };
  }

  // USER SETTINGS
  if (trimmed.startsWith('INSERT INTO user_settings')) {
    const [user_id, notifications, reminder_lead_time] = params;
    const existingIndex = storeData.user_settings.findIndex(s => s.user_id === user_id);
    if (existingIndex !== -1) {
      storeData.user_settings[existingIndex] = { user_id, notifications, reminder_lead_time };
    } else {
      storeData.user_settings.push({ user_id, notifications, reminder_lead_time });
    }
    saveJsonData();
    return { changes: 1 };
  }

  return { lastID: 1, changes: 1 };
};

export const get = async (sql, params = []) => {
  await ensureDbInitialized();
  const trimmed = sql.trim();

  // USERS
  if (trimmed.includes('FROM users WHERE email = ?')) {
    const email = params[0];
    return storeData.users.find(u => u.email === email) || null;
  }

  if (trimmed.includes('FROM users WHERE id = ?')) {
    const id = params[0];
    let user = storeData.users.find(u => u.id === id);
    if (!user && id) {
      user = {
        id,
        email: `${id}@user.dayscore`,
        name: 'DayScore User',
        created_at: new Date().toISOString()
      };
      storeData.users.push(user);
      saveJsonData();
    }
    return user || null;
  }

  // DAY ARCHIVES
  if (trimmed.includes('FROM day_archives WHERE user_id = ? AND date = ?')) {
    const [user_id, date] = params;
    return storeData.day_archives.find(a => a.user_id === user_id && a.date === date) || null;
  }

  // TASKS
  if (trimmed.includes('FROM tasks WHERE id = ? AND user_id = ?')) {
    const [id, user_id] = params;
    return storeData.tasks.find(t => t.id === id && t.user_id === user_id) || null;
  }

  // SETTINGS
  if (trimmed.includes('FROM user_settings WHERE user_id = ?')) {
    const user_id = params[0];
    return storeData.user_settings.find(s => s.user_id === user_id) || null;
  }

  return null;
};

export const all = async (sql, params = []) => {
  await ensureDbInitialized();
  const trimmed = sql.trim();

  // TASKS
  if (trimmed.includes('FROM tasks WHERE user_id = ?')) {
    const user_id = params[0];
    let list = storeData.tasks.filter(t => t.user_id === user_id);
    if (params.length > 1 && trimmed.includes('AND date = ?')) {
      const date = params[1];
      list = list.filter(t => t.date === date);
    }
    return list;
  }

  // DAY ARCHIVES
  if (trimmed.includes('FROM day_archives WHERE user_id = ?')) {
    const user_id = params[0];
    return storeData.day_archives.filter(a => a.user_id === user_id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  // USER REWARDS
  if (trimmed.includes('FROM user_rewards WHERE user_id = ?')) {
    const user_id = params[0];
    return storeData.user_rewards.filter(r => r.user_id === user_id);
  }

  // USER PUNISHMENTS
  if (trimmed.includes('FROM user_punishments WHERE user_id = ?')) {
    const user_id = params[0];
    return storeData.user_punishments.filter(p => p.user_id === user_id);
  }

  // CLAIMS LOG
  if (trimmed.includes('FROM claims_log WHERE user_id = ?')) {
    const user_id = params[0];
    return storeData.claims_log.filter(c => c.user_id === user_id);
  }

  return [];
};

export default { run, get, all, initDb, ensureDbInitialized };
