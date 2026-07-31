import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { generateToken, verifyTokenMiddleware } from './auth.js';
import connectDB, {
  User,
  Task,
  UserReward,
  UserPunishment,
  UserSettings,
  TaskTemplate,
  DailyReflection,
  UserStreakMilestone
} from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Clean & Robust Universal CORS Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "https://dayscore-daily.vercel.app",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    const cleanOrigin = origin.replace(/\/+$/, '');
    const isAllowed =
      allowedOrigins.some(o => o.replace(/\/+$/, '') === cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      /^http:\/\/localhost(:\d+)?$/.test(cleanOrigin);

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Ensure MongoDB Connection
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    return res.status(500).json({ error: 'Database connection failed' });
  }
});

const formatDoc = (doc) => {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const idStr = obj._id ? obj._id.toString() : obj.id;
  const { _id, ...rest } = obj;
  return { id: idStr, _id: idStr, ...rest };
};

const buildUserFilter = (userId, extraConditions = {}) => {
  const userConditions = [{ user_id: userId }];
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    userConditions.push({ user_id: new mongoose.Types.ObjectId(userId) });
  }

  const baseUserQuery = { $or: userConditions };

  if (!extraConditions || Object.keys(extraConditions).length === 0) {
    return baseUserQuery;
  }

  return {
    $and: [
      baseUserQuery,
      extraConditions
    ]
  };
};

// Root endpoint
app.get('/', (req, res) => {
  return res.json({ status: 'ok', message: 'DayScore MongoDB Backend API is running' });
});

// Health Check
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'MongoDB Atlas' });
});

// ==========================================
// Authentication Routes
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const rawUser = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: name.trim(),
      created_at: new Date().toISOString()
    });

    const user = formatDoc(rawUser);
    const token = generateToken({ id: user.id, email: user.email, name: user.name });

    return res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const rawUser = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (!rawUser) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = formatDoc(rawUser);
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name });

    return res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// Get Profile
app.get('/api/auth/me', verifyTokenMiddleware, async (req, res) => {
  try {
    const filterConditions = [{ _id: req.user.id }];
    if (mongoose.Types.ObjectId.isValid(req.user.id)) {
      filterConditions.push({ _id: new mongoose.Types.ObjectId(req.user.id) });
    }
    const rawUser = await User.findOne({ $or: filterConditions }).lean();
    if (!rawUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = formatDoc(rawUser);
    return res.json({
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: err.message || 'Server error.' });
  }
});

// ==========================================
// Task Routes
// ==========================================

// Get Tasks
app.get('/api/tasks', verifyTokenMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    const query = buildUserFilter(req.user.id, date ? { date } : {});

    const rawTasks = await Task.find(query).sort({ created_at: -1 }).lean();
    const tasks = rawTasks.map(formatDoc);
    return res.json({ tasks });
  } catch (err) {
    console.error('Fetch tasks error:', err);
    return res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// Create Task
app.post('/api/tasks', verifyTokenMiddleware, async (req, res) => {
  try {
    const {
      date, title, category, priority, status, dueDateTime, due_date_time,
      carriedOver, carried_over, reward, penalty,
      rewardClaimed, reward_claimed, rewardAcknowledged, reward_acknowledged,
      penaltyAccepted, penalty_accepted, penaltyAcknowledged, penalty_acknowledged,
      rating, maxRating, max_rating
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const taskDate = date || new Date().toISOString().substring(0, 10);
    const dueDate = dueDateTime || due_date_time || null;
    const isCarriedOver = carriedOver !== undefined ? (carriedOver ? 1 : 0) : (carried_over !== undefined ? (carried_over ? 1 : 0) : 0);

    const taskReward = reward || null;
    const taskPenalty = taskReward ? null : (penalty || null);
    const isRewardClaimed = taskReward ? (rewardClaimed || reward_claimed ? 1 : 0) : 0;
    const isRewardAcknowledged = taskReward ? (rewardAcknowledged || reward_acknowledged ? 1 : 0) : 0;
    const isPenaltyAccepted = taskPenalty ? (penaltyAccepted || penalty_accepted ? 1 : 0) : 0;
    const isPenaltyAcknowledged = taskPenalty ? (penaltyAcknowledged || penalty_acknowledged ? 1 : 0) : 0;

    const taskData = {
      _id: req.body._id || req.body.id || new mongoose.Types.ObjectId().toString(),
      user_id: req.user.id,
      date: taskDate,
      title: title.trim(),
      category: category || 'Work',
      priority: priority || 'Med',
      status: status || 'pending',
      due_date_time: dueDate,
      carried_over: isCarriedOver,
      reward: taskReward,
      penalty: taskPenalty,
      reward_claimed: isRewardClaimed,
      reward_acknowledged: isRewardAcknowledged,
      penalty_accepted: isPenaltyAccepted,
      penalty_acknowledged: isPenaltyAcknowledged,
      rating: rating !== undefined ? rating : null,
      max_rating: maxRating !== undefined ? maxRating : (max_rating !== undefined ? max_rating : null),
      created_at: new Date().toISOString()
    };

    const rawTask = await Task.create(taskData);
    const task = formatDoc(rawTask);
    return res.status(201).json({ task });
  } catch (err) {
    console.error('Create task error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create task.' });
  }
});

// Update Task
app.put('/api/tasks/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Task ID is required.' });
    }

    const updateFields = {};
    if (updates.title !== undefined) updateFields.title = updates.title;
    if (updates.category !== undefined) updateFields.category = updates.category;
    if (updates.priority !== undefined) updateFields.priority = updates.priority;
    if (updates.status !== undefined) updateFields.status = updates.status;
    if (updates.dueDateTime !== undefined) updateFields.due_date_time = updates.dueDateTime;
    if (updates.due_date_time !== undefined) updateFields.due_date_time = updates.due_date_time;
    if (updates.rating !== undefined) updateFields.rating = updates.rating;
    if (updates.maxRating !== undefined) updateFields.max_rating = updates.maxRating;
    if (updates.max_rating !== undefined) updateFields.max_rating = updates.max_rating;
    if (updates.reward !== undefined) updateFields.reward = updates.reward;
    if (updates.penalty !== undefined) updateFields.penalty = updates.penalty;
    if (updates.rewardClaimed !== undefined) updateFields.reward_claimed = updates.rewardClaimed ? 1 : 0;
    if (updates.reward_claimed !== undefined) updateFields.reward_claimed = updates.reward_claimed ? 1 : 0;
    if (updates.rewardAcknowledged !== undefined) updateFields.reward_acknowledged = updates.rewardAcknowledged ? 1 : 0;
    if (updates.reward_acknowledged !== undefined) updateFields.reward_acknowledged = updates.reward_acknowledged ? 1 : 0;
    if (updates.penaltyAccepted !== undefined) updateFields.penalty_accepted = updates.penaltyAccepted ? 1 : 0;
    if (updates.penalty_accepted !== undefined) updateFields.penalty_accepted = updates.penalty_accepted ? 1 : 0;
    if (updates.penaltyAcknowledged !== undefined) updateFields.penalty_acknowledged = updates.penaltyAcknowledged ? 1 : 0;
    if (updates.penalty_acknowledged !== undefined) updateFields.penalty_acknowledged = updates.penalty_acknowledged ? 1 : 0;
    if (updates.completedAt !== undefined) updateFields.completed_at = updates.completedAt;
    if (updates.completed_at !== undefined) updateFields.completed_at = updates.completed_at;

    // Enforce mutual exclusion between reward and penalty fields
    if (updateFields.reward) {
      updateFields.penalty_accepted = 0;
      updateFields.penalty = null;
    } else if (updateFields.penalty) {
      updateFields.reward_claimed = 0;
      updateFields.reward = null;
    } else if (updates.reward === null && updates.penalty === null) {
      updateFields.reward_claimed = 0;
      updateFields.penalty_accepted = 0;
      updateFields.reward = null;
      updateFields.penalty = null;
    }

    const filterConditions = [{ _id: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      try {
        filterConditions.push({ _id: new mongoose.Types.ObjectId(id) });
      } catch (e) {}
    }

    const queryFilter = buildUserFilter(req.user.id, { $or: filterConditions });

    const rawTask = await Task.findOneAndUpdate(
      queryFilter,
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!rawTask) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = formatDoc(rawTask);
    return res.json({ success: true, task });
  } catch (err) {
    console.error('Update task error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update task.' });
  }
});

// Delete Task
app.delete('/api/tasks/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Task ID is required.' });
    }

    const filterConditions = [{ _id: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      try {
        filterConditions.push({ _id: new mongoose.Types.ObjectId(id) });
      } catch (e) {}
    }

    const queryFilter = buildUserFilter(req.user.id, { $or: filterConditions });

    await Task.deleteOne(queryFilter);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete task.' });
  }
});

// ==========================================
// Rewards & Punishments Routes
// ==========================================

// Rewards
app.get('/api/rewards', verifyTokenMiddleware, async (req, res) => {
  try {
    const rewards = await UserReward.find(buildUserFilter(req.user.id)).sort({ created_at: 1 }).lean();
    return res.json({ rewards: rewards.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch rewards.' });
  }
});

app.post('/api/rewards', verifyTokenMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Reward text is required.' });

    await UserReward.create({
      user_id: req.user.id,
      text: text.trim(),
      created_at: new Date().toISOString()
    });

    const rewards = await UserReward.find(buildUserFilter(req.user.id)).sort({ created_at: 1 }).lean();
    return res.json({ rewards: rewards.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add reward.' });
  }
});

app.delete('/api/rewards', verifyTokenMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (text) {
      await UserReward.deleteMany(buildUserFilter(req.user.id, { text }));
    }
    const rewards = await UserReward.find(buildUserFilter(req.user.id)).sort({ created_at: 1 }).lean();
    return res.json({ rewards: rewards.map(r => r.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete reward.' });
  }
});

// Punishments
app.get('/api/punishments', verifyTokenMiddleware, async (req, res) => {
  try {
    const punishments = await UserPunishment.find(buildUserFilter(req.user.id)).sort({ created_at: 1 }).lean();
    return res.json({ punishments: punishments.map(p => p.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch punishments.' });
  }
});

app.post('/api/punishments', verifyTokenMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Punishment text is required.' });

    await UserPunishment.create({
      user_id: req.user.id,
      text: text.trim(),
      acknowledged: 0,
      created_at: new Date().toISOString()
    });

    const punishments = await UserPunishment.find(buildUserFilter(req.user.id)).sort({ created_at: 1 }).lean();
    return res.json({ punishments: punishments.map(p => p.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add punishment.' });
  }
});

app.delete('/api/punishments', verifyTokenMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (text) {
      await UserPunishment.deleteMany(buildUserFilter(req.user.id, { text }));
    }
    const punishments = await UserPunishment.find(buildUserFilter(req.user.id)).sort({ created_at: 1 }).lean();
    return res.json({ punishments: punishments.map(p => p.text) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete punishment.' });
  }
// Streak Milestones
app.get('/api/streak-milestones', verifyTokenMiddleware, async (req, res) => {
  try {
    let doc = await UserStreakMilestone.findOne(buildUserFilter(req.user.id)).lean();
    if (!doc) {
      doc = await UserStreakMilestone.create({
        user_id: req.user.id,
        milestones: { 7: '', 14: '', 30: '', 100: '' },
        claimed_milestones: { 7: false, 14: false, 30: false, 100: false }
      });
    }
    return res.json({
      milestones: doc.milestones || { 7: '', 14: '', 30: '', 100: '' },
      claimed_milestones: doc.claimed_milestones || { 7: false, 14: false, 30: false, 100: false }
    });
  } catch (err) {
    console.error('Fetch streak milestones error:', err);
    return res.status(500).json({ error: 'Failed to fetch streak milestones.' });
  }
});

app.put('/api/streak-milestones', verifyTokenMiddleware, async (req, res) => {
  try {
    const { milestones, claimed_milestones } = req.body;
    const updateFields = {
      updated_at: new Date().toISOString()
    };
    if (milestones && typeof milestones === 'object') {
      updateFields.milestones = milestones;
    }
    if (claimed_milestones && typeof claimed_milestones === 'object') {
      updateFields.claimed_milestones = claimed_milestones;
    }

    const doc = await UserStreakMilestone.findOneAndUpdate(
      buildUserFilter(req.user.id),
      {
        $set: updateFields,
        $setOnInsert: { user_id: req.user.id }
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({
      milestones: doc.milestones || { 7: '', 14: '', 30: '', 100: '' },
      claimed_milestones: doc.claimed_milestones || { 7: false, 14: false, 30: false, 100: false }
    });
  } catch (err) {
    console.error('Update streak milestones error:', err);
    return res.status(500).json({ error: 'Failed to update streak milestones.' });
  }
});

app.post('/api/streak-milestones/claim', verifyTokenMiddleware, async (req, res) => {
  try {
    const { days } = req.body;
    if (!days) return res.status(400).json({ error: 'Milestone days parameter required.' });

    let doc = await UserStreakMilestone.findOne(buildUserFilter(req.user.id)).lean();
    const currentClaimed = doc && doc.claimed_milestones ? { ...doc.claimed_milestones } : { 7: false, 14: false, 30: false, 100: false };
    currentClaimed[days] = true;

    const updatedDoc = await UserStreakMilestone.findOneAndUpdate(
      buildUserFilter(req.user.id),
      {
        $set: {
          claimed_milestones: currentClaimed,
          updated_at: new Date().toISOString()
        },
        $setOnInsert: { user_id: req.user.id, milestones: { 7: '', 14: '', 30: '', 100: '' } }
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({
      milestones: updatedDoc.milestones || { 7: '', 14: '', 30: '', 100: '' },
      claimed_milestones: updatedDoc.claimed_milestones || { 7: false, 14: false, 30: false, 100: false }
    });
  } catch (err) {
    console.error('Claim streak milestone error:', err);
    return res.status(500).json({ error: 'Failed to claim streak milestone reward.' });
  }
});

// ==========================================
// User Settings Routes
// ==========================================

app.get('/api/settings', verifyTokenMiddleware, async (req, res) => {
  try {
    let settings = await UserSettings.findOne(buildUserFilter(req.user.id)).lean();
    if (!settings) {
      settings = await UserSettings.create({
        user_id: req.user.id,
        notifications: 0,
        reminder_lead_time: 30
      });
    }
    return res.json({ settings });
  } catch (err) {
    console.error('Fetch settings error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch settings.' });
  }
});

app.put('/api/settings', verifyTokenMiddleware, async (req, res) => {
  try {
    const { notifications, reminderLeadTime, reminder_lead_time } = req.body;
    const leadTime = reminderLeadTime !== undefined ? reminderLeadTime : (reminder_lead_time !== undefined ? reminder_lead_time : 30);

    const settings = await UserSettings.findOneAndUpdate(
      buildUserFilter(req.user.id),
      {
        user_id: req.user.id,
        notifications: notifications ? 1 : 0,
        reminder_lead_time: leadTime
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({ settings });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update settings.' });
  }
});

// ==========================================
// Task Template Routes
// ==========================================

// Get all templates for authenticated user
app.get('/api/templates', verifyTokenMiddleware, async (req, res) => {
  try {
    const rawTemplates = await TaskTemplate.find(buildUserFilter(req.user.id)).sort({ created_at: -1 }).lean();
    const templates = rawTemplates.map(t => {
      const formatted = formatDoc(t);
      return {
        id: formatted.id,
        title: formatted.title,
        category: formatted.category || 'Work',
        priority: formatted.priority || 'Med',
        defaultDate: formatted.default_date || null,
        defaultHour: formatted.default_hour !== undefined ? formatted.default_hour : null,
        defaultMinute: formatted.default_minute !== undefined ? formatted.default_minute : null,
        relativeTime: formatted.relative_time || null
      };
    });
    return res.json({ templates });
  } catch (err) {
    console.error('Fetch templates error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch templates.' });
  }
});

// Create new template
app.post('/api/templates', verifyTokenMiddleware, async (req, res) => {
  try {
    const { title, category, priority, defaultDate, defaultHour, defaultMinute, relativeTime } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Template title is required.' });
    }

    const rawTemplate = await TaskTemplate.create({
      user_id: req.user.id,
      title: title.trim(),
      category: category || 'Work',
      priority: priority || 'Med',
      default_date: defaultDate || null,
      default_hour: defaultHour !== undefined ? defaultHour : null,
      default_minute: defaultMinute !== undefined ? defaultMinute : null,
      relative_time: relativeTime || null
    });

    const formatted = formatDoc(rawTemplate);
    const template = {
      id: formatted.id,
      title: formatted.title,
      category: formatted.category,
      priority: formatted.priority,
      defaultDate: formatted.default_date,
      defaultHour: formatted.default_hour,
      defaultMinute: formatted.default_minute,
      relativeTime: formatted.relative_time
    };

    return res.status(201).json({ template });
  } catch (err) {
    console.error('Create template error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create template.' });
  }
});

// Update template
app.put('/api/templates/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, priority, defaultDate, defaultHour, defaultMinute, relativeTime } = req.body;

    const filter = buildUserFilter(req.user.id, {
      $or: [
        { _id: id },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    });

    const rawTemplate = await TaskTemplate.findOneAndUpdate(
      filter,
      {
        title: title ? title.trim() : 'Untitled',
        category: category || 'Work',
        priority: priority || 'Med',
        default_date: defaultDate || null,
        default_hour: defaultHour !== undefined ? defaultHour : null,
        default_minute: defaultMinute !== undefined ? defaultMinute : null,
        relative_time: relativeTime || null
      },
      { new: true }
    ).lean();

    if (!rawTemplate) {
      return res.status(404).json({ error: 'Template not found.' });
    }

    const formatted = formatDoc(rawTemplate);
    const template = {
      id: formatted.id,
      title: formatted.title,
      category: formatted.category,
      priority: formatted.priority,
      defaultDate: formatted.default_date,
      defaultHour: formatted.default_hour,
      defaultMinute: formatted.default_minute,
      relativeTime: formatted.relative_time
    };

    return res.json({ template });
  } catch (err) {
    console.error('Update template error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update template.' });
  }
});

// Delete template
app.delete('/api/templates/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const filter = buildUserFilter(req.user.id, {
      $or: [
        { _id: id },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    });

    await TaskTemplate.deleteMany(filter);
    return res.json({ success: true, id });
  } catch (err) {
    console.error('Delete template error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete template.' });
  }
});

// ==========================================
// Daily Reflection Routes (CRUD per day)
// ==========================================

// Get reflection for a specific date
app.get('/api/reflections/:date', verifyTokenMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const filter = buildUserFilter(req.user.id, { date });
    const reflection = await DailyReflection.findOne(filter).lean();
    return res.json({ reflection: reflection ? formatDoc(reflection) : null });
  } catch (err) {
    console.error('Fetch reflection error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch reflection.' });
  }
});

// Upsert (create or update) reflection for a date
app.put('/api/reflections/:date', verifyTokenMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const { content } = req.body;

    const filter = buildUserFilter(req.user.id, { date });
    const reflection = await DailyReflection.findOneAndUpdate(
      filter,
      {
        user_id: req.user.id,
        date,
        content: content || '',
        updated_at: new Date().toISOString()
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({ reflection: formatDoc(reflection) });
  } catch (err) {
    console.error('Save reflection error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save reflection.' });
  }
});

// Delete/Clear reflection for a date
app.delete('/api/reflections/:date', verifyTokenMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const filter = buildUserFilter(req.user.id, { date });
    await DailyReflection.deleteMany(filter);
    return res.json({ success: true, date });
  } catch (err) {
    console.error('Delete reflection error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete reflection.' });
  }
});

// Global Error Handler - Ensures CORS headers are preserved even on unexpected server errors
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Export app for Vercel Serverless
export default app;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`DayScore MongoDB Backend API running on http://localhost:${PORT}`);
  });
}
