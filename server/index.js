import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { initDb, ensureDbInitialized, run, get, all } from './db.js';
import { generateToken, verifyTokenMiddleware } from './auth.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// Middleware ensuring DB schema is ready before handling any request
app.use(async (req, res, next) => {
  try {
    await ensureDbInitialized();
    next();
  } catch (err) {
    console.error('Database initialization middleware error:', err);
    res.status(500).json({ error: 'Database initialization failed.' });
  }
});

// Helper for generating IDs if uuid package is not used
const createId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

// Default seed rewards & punishments for new users
const DEFAULT_REWARDS = [
  '30 minutes of video games',
  'Favorite dessert / snack',
  'Watch one episode of favorite show',
  'Guilt-free relaxation time',
  'Buy a small wish-list item'
];

const DEFAULT_PUNISHMENTS = [
  'No social media for 24 hours',
  'Cold shower tomorrow morning',
  '20 extra pushups / burpees',
  'No YouTube / Netflix for a day',
  'Donate $5 to charity'
];

const seedDefaultsForUser = async (userId) => {
  for (const text of DEFAULT_REWARDS) {
    await run(
      'INSERT INTO user_rewards (id, user_id, text, created_at) VALUES (?, ?, ?, ?)',
      [createId(), userId, text, new Date().toISOString()]
    );
  }
  for (const text of DEFAULT_PUNISHMENTS) {
    await run(
      'INSERT INTO user_punishments (id, user_id, text, acknowledged, created_at) VALUES (?, ?, ?, 0, ?)',
      [createId(), userId, text, new Date().toISOString()]
    );
  }
  await run(
    'INSERT INTO user_settings (user_id, notifications, reminder_lead_time) VALUES (?, 0, 30)',
    [userId]
  );
};

// ==========================================
// Authentication Endpoints
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = createId();
    const now = new Date().toISOString();

    await run(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, normalizedEmail, hashedPassword, name.trim(), now]
    );

    // Seed default rewards & punishments
    await seedDefaultsForUser(userId);

    const userObj = { id: userId, name: name.trim(), email: normalizedEmail };
    const token = generateToken(userObj);

    return res.status(201).json({ token, user: userObj });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userObj = { id: user.id, name: user.name, email: user.email };
    const token = generateToken(userObj);

    return res.json({ token, user: userObj });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// Get current user profile
app.get('/api/auth/me', verifyTokenMiddleware, async (req, res) => {
  try {
    const user = await get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(401).json({ error: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ==========================================
// Tasks Endpoints (Protected)
// ==========================================

app.get('/api/tasks', verifyTokenMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    let sql = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [req.user.id];

    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    }
    sql += ' ORDER BY created_at DESC';

    const rows = await all(sql, params);
    const tasks = rows.map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      priority: r.priority,
      status: r.status,
      dueDateTime: r.due_date_time,
      rating: r.rating,
      maxRating: r.max_rating,
      reward: r.reward,
      penalty: r.penalty,
      rewardClaimed: Boolean(r.reward_claimed),
      penaltyAccepted: Boolean(r.penalty_accepted),
      carriedOver: Boolean(r.carried_over),
      completedAt: r.completed_at,
      createdAt: r.created_at
    }));

    return res.json({ tasks });
  } catch (err) {
    console.error('Get tasks error:', err);
    return res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

app.post('/api/tasks', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id, date, title, category, priority, dueDateTime, status, carriedOver } = req.body;
    if (!date || !title) {
      return res.status(400).json({ error: 'Date and title are required.' });
    }

    const taskId = id || createId();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO tasks (
        id, user_id, date, title, category, priority, status, 
        due_date_time, carried_over, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        req.user.id,
        date,
        title.trim(),
        category || 'Work',
        priority || 'Med',
        status || 'pending',
        dueDateTime || null,
        carriedOver ? 1 : 0,
        now
      ]
    );

    const newTask = {
      id: taskId,
      title: title.trim(),
      category: category || 'Work',
      priority: priority || 'Med',
      status: status || 'pending',
      dueDateTime: dueDateTime || null,
      carriedOver: Boolean(carriedOver),
      createdAt: now
    };

    return res.status(201).json({ task: newTask });
  } catch (err) {
    console.error('Add task error:', err);
    return res.status(500).json({ error: 'Failed to create task.' });
  }
});

app.put('/api/tasks/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    let existing = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      existing = {
        id,
        user_id: req.user.id,
        title: updates.title || 'Task',
        category: updates.category || 'Work',
        priority: updates.priority || 'Med',
        status: updates.status || 'pending',
        due_date_time: updates.dueDateTime || null,
        rating: null,
        max_rating: null,
        reward: null,
        penalty: null,
        reward_claimed: 0,
        penalty_accepted: 0,
        completed_at: null
      };
    }

    const title = updates.title !== undefined ? updates.title : existing.title;
    const category = updates.category !== undefined ? updates.category : existing.category;
    const priority = updates.priority !== undefined ? updates.priority : existing.priority;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const dueDateTime = updates.dueDateTime !== undefined ? updates.dueDateTime : (updates.due_date_time !== undefined ? updates.due_date_time : existing.due_date_time);
    const rating = updates.rating !== undefined ? updates.rating : existing.rating;
    const maxRating = updates.maxRating !== undefined ? updates.maxRating : (updates.max_rating !== undefined ? updates.max_rating : existing.max_rating);
    const reward = updates.reward !== undefined ? updates.reward : existing.reward;
    const penalty = updates.penalty !== undefined ? updates.penalty : existing.penalty;
    const rewardClaimed = updates.rewardClaimed !== undefined ? (updates.rewardClaimed ? 1 : 0) : (updates.reward_claimed !== undefined ? (updates.reward_claimed ? 1 : 0) : existing.reward_claimed);
    const penaltyAccepted = updates.penaltyAccepted !== undefined ? (updates.penaltyAccepted ? 1 : 0) : (updates.penalty_accepted !== undefined ? (updates.penalty_accepted ? 1 : 0) : existing.penalty_accepted);
    const completedAt = updates.completedAt !== undefined ? updates.completedAt : (updates.completed_at !== undefined ? updates.completed_at : existing.completed_at);

    await run(
      `UPDATE tasks SET
        title = ?, category = ?, priority = ?, status = ?, due_date_time = ?,
        rating = ?, max_rating = ?, reward = ?, penalty = ?,
        reward_claimed = ?, penalty_accepted = ?, completed_at = ?
      WHERE id = ? AND user_id = ?`,
      [
        title, category, priority, status, dueDateTime,
        rating, maxRating, reward, penalty,
        rewardClaimed, penaltyAccepted, completedAt,
        id, req.user.id
      ]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Update task error:', err);
    return res.status(500).json({ error: 'Failed to update task.' });
  }
});

app.delete('/api/tasks/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// ==========================================
// Day Archives Endpoints (Protected)
// ==========================================

app.get('/api/archives', verifyTokenMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM day_archives WHERE user_id = ? ORDER BY date DESC', [req.user.id]);
    const archives = rows.map(r => ({
      id: r.id,
      date: r.date,
      score: r.score,
      reflection: r.reflection,
      reward: r.reward,
      rewardAcknowledged: Boolean(r.reward_acknowledged)
    }));
    return res.json({ archives });
  } catch (err) {
    console.error('Get archives error:', err);
    return res.status(500).json({ error: 'Failed to fetch archives.' });
  }
});

app.post('/api/archives', verifyTokenMiddleware, async (req, res) => {
  try {
    const { date, score, reflection, reward, rewardAcknowledged } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required.' });

    const existing = await get('SELECT id FROM day_archives WHERE user_id = ? AND date = ?', [req.user.id, date]);
    const now = new Date().toISOString();

    if (existing) {
      await run(
        `UPDATE day_archives SET
          score = COALESCE(?, score),
          reflection = COALESCE(?, reflection),
          reward = COALESCE(?, reward),
          reward_acknowledged = COALESCE(?, reward_acknowledged)
        WHERE id = ? AND user_id = ?`,
        [
          score !== undefined ? score : null,
          reflection !== undefined ? reflection : null,
          reward !== undefined ? reward : null,
          rewardAcknowledged !== undefined ? (rewardAcknowledged ? 1 : 0) : null,
          existing.id,
          req.user.id
        ]
      );
    } else {
      const arcId = createId();
      await run(
        `INSERT INTO day_archives (id, user_id, date, score, reflection, reward, reward_acknowledged, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          arcId,
          req.user.id,
          date,
          score || 0,
          reflection || '',
          reward || null,
          rewardAcknowledged ? 1 : 0,
          now
        ]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Save archive error:', err);
    return res.status(500).json({ error: 'Failed to save archive.' });
  }
});

// ==========================================
// Rewards & Punishments Endpoints (Protected)
// ==========================================

app.get('/api/rewards', verifyTokenMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM user_rewards WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    return res.json({ rewards: rows.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch rewards.' });
  }
});

app.post('/api/rewards', verifyTokenMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Reward text is required.' });

    await run(
      'INSERT INTO user_rewards (id, user_id, text, created_at) VALUES (?, ?, ?, ?)',
      [createId(), req.user.id, text.trim(), new Date().toISOString()]
    );

    const rows = await all('SELECT text FROM user_rewards WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    return res.json({ rewards: rows.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add reward.' });
  }
});

app.delete('/api/rewards', verifyTokenMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (text) {
      await run('DELETE FROM user_rewards WHERE user_id = ? AND text = ?', [req.user.id, text]);
    }
    const rows = await all('SELECT text FROM user_rewards WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    return res.json({ rewards: rows.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete reward.' });
  }
});

app.get('/api/punishments', verifyTokenMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM user_punishments WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    return res.json({ punishments: rows.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch punishments.' });
  }
});

app.post('/api/punishments', verifyTokenMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Punishment text is required.' });

    await run(
      'INSERT INTO user_punishments (id, user_id, text, created_at) VALUES (?, ?, ?, ?)',
      [createId(), req.user.id, text.trim(), new Date().toISOString()]
    );

    const rows = await all('SELECT text FROM user_punishments WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    return res.json({ punishments: rows.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add punishment.' });
  }
});

app.delete('/api/punishments', verifyTokenMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (text) {
      await run('DELETE FROM user_punishments WHERE user_id = ? AND text = ?', [req.user.id, text]);
    }
    const rows = await all('SELECT text FROM user_punishments WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    return res.json({ punishments: rows.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete punishment.' });
  }
});

// ==========================================
// Claims Log Endpoints (Protected)
// ==========================================

app.get('/api/claims', verifyTokenMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM claims_log WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    return res.json({ claims: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch claims.' });
  }
});

app.post('/api/claims', verifyTokenMiddleware, async (req, res) => {
  try {
    const { type, text, date } = req.body;
    if (!type || !text) return res.status(400).json({ error: 'Type and text are required.' });

    await run(
      'INSERT INTO claims_log (id, user_id, type, text, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [createId(), req.user.id, type, text, date || new Date().toISOString().substring(0, 10), new Date().toISOString()]
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to log claim.' });
  }
});

// ==========================================
// Settings Endpoints (Protected)
// ==========================================

app.get('/api/settings', verifyTokenMiddleware, async (req, res) => {
  try {
    let settings = await get('SELECT * FROM user_settings WHERE user_id = ?', [req.user.id]);
    if (!settings) {
      await run('INSERT INTO user_settings (user_id, notifications, reminder_lead_time) VALUES (?, 0, 30)', [req.user.id]);
      settings = { notifications: 0, reminder_lead_time: 30 };
    }
    return res.json({
      settings: {
        notifications: Boolean(settings.notifications),
        reminderLeadTime: settings.reminder_lead_time
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

app.put('/api/settings', verifyTokenMiddleware, async (req, res) => {
  try {
    const { notifications, reminderLeadTime } = req.body;
    await run(
      `INSERT INTO user_settings (user_id, notifications, reminder_lead_time) 
       VALUES (?, ?, ?) 
       ON CONFLICT(user_id) DO UPDATE SET 
       notifications = excluded.notifications, 
       reminder_lead_time = excluded.reminder_lead_time`,
      [req.user.id, notifications ? 1 : 0, reminderLeadTime || 30]
    );

    return res.json({
      settings: {
        notifications: Boolean(notifications),
        reminderLeadTime: reminderLeadTime || 30
      }
    });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`DayScore Backend API running on http://localhost:${PORT}`);
  });
}

export default app;
