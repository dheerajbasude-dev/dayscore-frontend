import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dheerajbasude880:hUlbYTIyQaQxgNJL@cluster0.gys14ss.mongodb.net/dayscore?retryWrites=true&w=majority';

let cachedConnection = global.mongooseConnection;
if (!cachedConnection) {
  cachedConnection = global.mongooseConnection = { conn: null, promise: null };
}

export const connectDB = async () => {
  if (cachedConnection.conn && mongoose.connection.readyState === 1) {
    return cachedConnection.conn;
  }

  if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
    cachedConnection.conn = null;
    cachedConnection.promise = null;
  }

  if (!cachedConnection.promise) {
    const opts = {
      maxPoolSize: 2,
      minPoolSize: 1,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cachedConnection.promise = mongoose.connect(MONGODB_URI, opts)
      .then((m) => {
        return m.connection;
      })
      .catch((err) => {
        cachedConnection.promise = null;
        cachedConnection.conn = null;
        throw err;
      });
  }

  try {
    cachedConnection.conn = await cachedConnection.promise;
  } catch (err) {
    cachedConnection.promise = null;
    cachedConnection.conn = null;
    throw err;
  }

  return cachedConnection.conn;
};

// Native Mongoose Schemas (auto-generated MongoDB ObjectId for _id)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  created_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false });

const taskSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.Mixed, default: () => new mongoose.Types.ObjectId().toString() },
  user_id: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  date: { type: String, required: true, index: true },
  title: { type: String, required: true },
  category: { type: String, default: 'Work' },
  priority: { type: String, default: 'Med' },
  status: { type: String, default: 'pending' },
  due_date_time: { type: String, default: null },
  rating: { type: Number, default: null },
  max_rating: { type: Number, default: null },
  reward: { type: String, default: null },
  penalty: { type: String, default: null },
  reward_claimed: { type: Number, default: 0 },
  reward_acknowledged: { type: Number, default: 0 },
  penalty_accepted: { type: Number, default: 0 },
  penalty_acknowledged: { type: Number, default: 0 },
  carried_over: { type: Number, default: 0 },
  completed_at: { type: String, default: null },
  created_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false });

const rewardSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  text: { type: String, required: true },
  created_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false });
rewardSchema.index({ user_id: 1, text: 1 }, { unique: true });

const punishmentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  text: { type: String, required: true },
  acknowledged: { type: Number, default: 0 },
  created_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false });
punishmentSchema.index({ user_id: 1, text: 1 }, { unique: true });

const userSettingsSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.Mixed, required: true, unique: true, index: true },
  notifications: { type: Number, default: 0 },
  reminder_lead_time: { type: Number, default: 30 },
  seeded: { type: Number, default: 0 },
  created_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false });

const templateSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.Mixed, default: () => new mongoose.Types.ObjectId().toString() },
  user_id: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  title: { type: String, required: true },
  category: { type: String, default: 'Work' },
  priority: { type: String, default: 'Med' },
  default_date: { type: String, default: null },
  default_hour: { type: Number, default: null },
  default_minute: { type: Number, default: null },
  relative_time: { type: String, default: null },
  created_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false });

const reflectionSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.Mixed, default: () => new mongoose.Types.ObjectId().toString() },
  user_id: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  date: { type: String, required: true, index: true },
  content: { type: String, default: '' },
  updated_at: { type: String, default: () => new Date().toISOString() },
  created_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false });
reflectionSchema.index({ user_id: 1, date: 1 }, { unique: true });

const userStreakMilestoneSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.Mixed, required: true, unique: true, index: true },
  milestones: { type: Object, default: { 7: '', 14: '', 30: '', 100: '' } },
  claimed_milestones: { type: Object, default: { 7: false, 14: false, 30: false, 100: false } },
  updated_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false, minimize: false, collection: 'user_streak_milestones' });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
export const UserReward = mongoose.models.UserReward || mongoose.model('UserReward', rewardSchema);
export const UserPunishment = mongoose.models.UserPunishment || mongoose.model('UserPunishment', punishmentSchema);
export const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', userSettingsSchema);
export const TaskTemplate = mongoose.models.TaskTemplate || mongoose.model('TaskTemplate', templateSchema);
export const DailyReflection = mongoose.models.DailyReflection || mongoose.model('DailyReflection', reflectionSchema);
export const UserStreakMilestone = mongoose.models.UserStreakMilestone || mongoose.model('UserStreakMilestone', userStreakMilestoneSchema);

export default connectDB;
