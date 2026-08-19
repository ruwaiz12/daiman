const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/daily';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB.');
    await migrateJSONToMongoDB();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schemas & Models
const CategorySchema = new mongoose.Schema({
  _id: { type: String, required: true }, // custom ID (e.g. 'cat-health')
  name: { type: String, required: true },
  icon: { type: String, required: true }
}, { _id: false });
const Category = mongoose.model('Category', CategorySchema);

const ActivitySchema = new mongoose.Schema({
  _id: { type: String, required: true }, // custom ID (e.g. 'act-...')
  title: { type: String, required: true },
  category: { type: String, required: true },
  weight: { type: String, required: true },
  date: { type: String, default: null },
  time: { type: String, default: null },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });
const Activity = mongoose.model('Activity', ActivitySchema);

const GoalSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // custom ID (e.g. 'goal-...')
  title: { type: String, required: true },
  category: { type: String, required: true },
  targetDate: { type: String, required: true },
  progress: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });
const Goal = mongoose.model('Goal', GoalSchema);

const TransactionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  desc: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true }
}, { _id: false });

const DailyLogSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // the YYYY-MM-DD date string
  activeIds: { type: [String], default: [] },
  completedIds: { type: [String], default: [] },
  notes: { type: String, default: '' },
  mood: { type: Number, default: 0 },
  finance: {
    income: { type: Number, default: 0 },
    expense: { type: Number, default: 0 },
    debt: { type: Number, default: 0 },
    receivable: { type: Number, default: 0 },
    transactions: { type: [TransactionSchema], default: [] }
  },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });
const DailyLog = mongoose.model('DailyLog', DailyLogSchema);

const ACTIVITIES_FILE = path.join(__dirname, 'data', 'activities.json');
const LOGS_FILE = path.join(__dirname, 'data', 'logs.json');
const CATEGORIES_FILE = path.join(__dirname, 'data', 'categories.json');
const GOALS_FILE = path.join(__dirname, 'data', 'goals.json');

// Auto-Migration from local JSON files to MongoDB
async function migrateJSONToMongoDB() {
  try {
    const categoryCount = await Category.countDocuments();
    if (categoryCount > 0) {
      console.log('Database already populated, skipping migration.');
      return;
    }

    console.log('MongoDB database is empty. Starting auto-migration from local JSON files...');

    // Helper to read JSON files safely inside migration
    function readJSON(filePath, defaultVal = []) {
      try {
        if (!fs.existsSync(filePath)) {
          return defaultVal;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data || JSON.stringify(defaultVal));
      } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return defaultVal;
      }
    }

    // 1. Migrate Categories
    if (fs.existsSync(CATEGORIES_FILE)) {
      const categories = readJSON(CATEGORIES_FILE, []);
      if (categories.length > 0) {
        const catDocs = categories.map(c => ({
          _id: c.id,
          name: c.name,
          icon: c.icon
        }));
        await Category.insertMany(catDocs);
        console.log(`Migrated ${categories.length} categories.`);
      }
    }

    // 2. Migrate Activities
    if (fs.existsSync(ACTIVITIES_FILE)) {
      const activities = readJSON(ACTIVITIES_FILE, []);
      if (activities.length > 0) {
        const actDocs = activities.map(a => ({
          _id: a.id,
          title: a.title,
          category: a.category,
          weight: a.weight,
          date: a.date || null,
          time: a.time || null,
          deleted: a.deleted || false,
          deletedAt: a.deletedAt ? new Date(a.deletedAt) : null,
          createdAt: a.createdAt ? new Date(a.createdAt) : new Date()
        }));
        await Activity.insertMany(actDocs);
        console.log(`Migrated ${activities.length} activities.`);
      }
    }

    // 3. Migrate Goals
    if (fs.existsSync(GOALS_FILE)) {
      const goals = readJSON(GOALS_FILE, []);
      if (goals.length > 0) {
        const goalDocs = goals.map(g => ({
          _id: g.id,
          title: g.title,
          category: g.category,
          targetDate: g.targetDate,
          progress: g.progress || 0,
          createdAt: g.createdAt ? new Date(g.createdAt) : new Date()
        }));
        await Goal.insertMany(goalDocs);
        console.log(`Migrated ${goals.length} goals.`);
      }
    }

    // 4. Migrate Daily Logs
    if (fs.existsSync(LOGS_FILE)) {
      const logs = readJSON(LOGS_FILE, {});
      const logDates = Object.keys(logs);
      if (logDates.length > 0) {
        const logDocs = logDates.map(dateStr => {
          const l = logs[dateStr];
          const finance = l.finance || { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] };
          return {
            _id: dateStr,
            activeIds: Array.isArray(l.activeIds) ? l.activeIds : [],
            completedIds: Array.isArray(l.completedIds) ? l.completedIds : [],
            notes: l.notes || '',
            mood: l.mood || 0,
            finance: {
              income: finance.income || 0,
              expense: finance.expense || 0,
              debt: finance.debt || 0,
              receivable: finance.receivable || 0,
              transactions: Array.isArray(finance.transactions) ? finance.transactions.map(tx => ({
                id: tx.id,
                desc: tx.desc,
                amount: tx.amount,
                type: tx.type
              })) : []
            },
            updatedAt: l.updatedAt ? new Date(l.updatedAt) : new Date()
          };
        });
        await DailyLog.insertMany(logDocs);
        console.log(`Migrated ${logDocs.length} daily logs.`);
      }
    }

    console.log('Data migration completed successfully!');
  } catch (err) {
    console.error('Error migrating data to MongoDB:', err);
  }
}

// Helper to read JSON files safely
function readJSON(filePath, defaultVal = []) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultVal;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || JSON.stringify(defaultVal));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultVal;
  }
}

// Helper to write JSON files safely
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
    return false;
  }
}

// Helper to filter activities active on a specific date (YYYY-MM-DD)
// Looks up saved activeIds in logs database, or falls back to default schedule
function getActiveActivitiesForDate(activities, logs, date) {
  const log = logs[date];
  if (log && Array.isArray(log.activeIds)) {
    return activities.filter(act => log.activeIds.includes(act.id));
  }
  // Default: recurring + one-offs scheduled for this date
  return activities.filter(act => {
    if (act.deleted) return false; // Skip soft-deleted activities in new schedules
    if (!act.date) return true; // recurring
    return act.date === date; // one-off
  });
}

// Helper to calculate daily performance score
function calculateDailyScore(completedIds, activities) {
  if (!activities || activities.length === 0) return 0;
  
  const weightMap = { high: 3, medium: 2, low: 1 };
  let totalPossibleWeight = 0;
  let earnedWeight = 0;

  activities.forEach(activity => {
    const weightVal = weightMap[activity.weight] || 1;
    totalPossibleWeight += weightVal;
    if (completedIds.includes(activity.id)) {
      earnedWeight += weightVal;
    }
  });

  return totalPossibleWeight > 0 ? Math.round((earnedWeight / totalPossibleWeight) * 100) : 0;
}

// Mapping helpers for Mongoose documents
function mapActivity(act) {
  return {
    id: act._id,
    title: act.title,
    category: act.category,
    weight: act.weight,
    date: act.date,
    time: act.time,
    deleted: act.deleted,
    deletedAt: act.deletedAt,
    createdAt: act.createdAt
  };
}

function mapGoal(g) {
  return {
    id: g._id,
    title: g.title,
    category: g.category,
    targetDate: g.targetDate,
    progress: g.progress,
    createdAt: g.createdAt
  };
}

// -------------------------------------------------------------
// Categories API
// -------------------------------------------------------------

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories.map(c => ({ id: c._id, name: c.name, icon: c.icon })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// Add a category
app.post('/api/categories', async (req, res) => {
  const { name, icon } = req.body;
  if (!name || !icon) {
    return res.status(400).json({ error: 'Name and icon are required.' });
  }

  try {
    const normalized = name.toLowerCase().trim();
    const categories = await Category.find();
    if (categories.some(c => c.name.toLowerCase().trim() === normalized)) {
      return res.status(400).json({ error: 'Category already exists.' });
    }

    const id = 'cat-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await Category.create({ _id: id, name: name.trim(), icon: icon.trim() });

    const updated = await Category.find();
    res.status(201).json(updated.map(c => ({ id: c._id, name: c.name, icon: c.icon })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});


// -------------------------------------------------------------
// Activities CRUD
// -------------------------------------------------------------

// Get all activities
app.get('/api/activities', async (req, res) => {
  try {
    const activities = await Activity.find();
    res.json(activities.map(mapActivity));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activities.' });
  }
});

// Add activity
app.post('/api/activities', async (req, res) => {
  const { title, category, weight, date, time } = req.body;
  if (!title || !category || !weight) {
    return res.status(400).json({ error: 'Title, category, and weight are required.' });
  }

  try {
    const id = 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    await Activity.create({
      _id: id,
      title,
      category,
      weight,
      date: date || null,
      time: time || null,
      createdAt: new Date()
    });

    const updated = await Activity.find();
    res.status(201).json(updated.map(mapActivity));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create activity.' });
  }
});

// Update activity
app.put('/api/activities/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, weight, date, time } = req.body;

  try {
    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found.' });
    }

    if (title !== undefined) activity.title = title;
    if (category !== undefined) activity.category = category;
    if (weight !== undefined) activity.weight = weight;
    if (date !== undefined) activity.date = date;
    if (time !== undefined) activity.time = time;

    await activity.save();

    const updated = await Activity.find();
    res.json(updated.map(mapActivity));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update activity.' });
  }
});

// Delete activity (Soft-Delete & Logs cleanup for current/future dates)
app.delete('/api/activities/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found.' });
    }

    activity.deleted = true;
    activity.deletedAt = new Date();
    await activity.save();

    const todayStr = new Date().toISOString().split('T')[0];
    const logs = await DailyLog.find({ _id: { $gte: todayStr } });

    for (const log of logs) {
      let changed = false;
      if (log.activeIds.includes(id)) {
        log.activeIds = log.activeIds.filter(aid => aid !== id);
        changed = true;
      }
      if (log.completedIds.includes(id)) {
        log.completedIds = log.completedIds.filter(cid => cid !== id);
        changed = true;
      }
      if (changed) {
        await log.save();
      }
    }

    const updated = await Activity.find();
    res.json(updated.map(mapActivity));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete activity.' });
  }
});


// -------------------------------------------------------------
// Daily Logs (with Finance tracking support)
// -------------------------------------------------------------

// Get log for a specific date
app.get('/api/logs/:date', async (req, res) => {
  const { date } = req.params;

  try {
    let log = await DailyLog.findById(date);
    const activities = await Activity.find();

    if (!log) {
      log = new DailyLog({
        _id: date,
        completedIds: [],
        notes: '',
        mood: 0,
        finance: { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] }
      });
    }

    if (!log.activeIds || log.activeIds.length === 0) {
      const allLogs = await DailyLog.find();
      const logsMap = {};
      allLogs.forEach(l => {
        logsMap[l._id] = l;
      });
      logsMap[date] = log;

      const defaultActive = getActiveActivitiesForDate(activities.map(mapActivity), logsMap, date);
      log.activeIds = defaultActive.map(act => act.id);
    }

    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch daily log.' });
  }
});

// Save log for a specific date
app.post('/api/logs/:date', async (req, res) => {
  const { date } = req.params;
  const { completedIds, activeIds, notes, mood, finance } = req.body;

  if (!Array.isArray(completedIds)) {
    return res.status(400).json({ error: 'completedIds must be an array.' });
  }

  try {
    const log = await DailyLog.findByIdAndUpdate(
      date,
      {
        activeIds: Array.isArray(activeIds) ? activeIds : [],
        completedIds,
        notes: notes || '',
        mood: mood || 0,
        finance: finance || { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] },
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save daily log.' });
  }
});


// -------------------------------------------------------------
// Life Goals & Milestones API
// -------------------------------------------------------------

// Get all goals
app.get('/api/goals', async (req, res) => {
  try {
    const goals = await Goal.find();
    res.json(goals.map(mapGoal));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch goals.' });
  }
});

// Add a goal
app.post('/api/goals', async (req, res) => {
  const { title, category, targetDate, progress } = req.body;
  if (!title || !category || !targetDate) {
    return res.status(400).json({ error: 'Title, category, and target date are required.' });
  }

  try {
    const id = 'goal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    await Goal.create({
      _id: id,
      title: title.trim(),
      category,
      targetDate,
      progress: progress !== undefined ? parseInt(progress) : 0,
      createdAt: new Date()
    });

    const updated = await Goal.find();
    res.status(201).json(updated.map(mapGoal));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create goal.' });
  }
});

// Update a goal
app.put('/api/goals/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, targetDate, progress } = req.body;

  try {
    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    if (title !== undefined) goal.title = title.trim();
    if (category !== undefined) goal.category = category;
    if (targetDate !== undefined) goal.targetDate = targetDate;
    if (progress !== undefined) goal.progress = parseInt(progress);

    await goal.save();

    const updated = await Goal.find();
    res.json(updated.map(mapGoal));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update goal.' });
  }
});

// Delete a goal
app.delete('/api/goals/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const goal = await Goal.findByIdAndDelete(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    const updated = await Goal.find();
    res.json(updated.map(mapGoal));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete goal.' });
  }
});


// -------------------------------------------------------------
// Analytics
// -------------------------------------------------------------

// Get detailed analytics and performance
app.get('/api/analytics', async (req, res) => {
  try {
    const activitiesRaw = await Activity.find();
    const activities = activitiesRaw.map(mapActivity);
    
    const logsRaw = await DailyLog.find();
    const logs = {};
    logsRaw.forEach(l => {
      logs[l._id] = l;
    });

    const dailyScores = {};
    Object.keys(logs).forEach(date => {
      const activeActivities = getActiveActivitiesForDate(activities, logs, date);
      dailyScores[date] = calculateDailyScore(logs[date].completedIds, activeActivities);
    });

    const loggedDates = Object.keys(logs)
      .filter(date => logs[date].completedIds.length > 0)
      .sort();

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    let prevDateObj = null;

    loggedDates.forEach(dateStr => {
      const currentDateObj = new Date(dateStr + 'T00:00:00');
      if (prevDateObj === null) {
        tempStreak = 1;
      } else {
        const diffTime = Math.abs(currentDateObj - prevDateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          if (tempStreak > maxStreak) {
            maxStreak = tempStreak;
          }
          tempStreak = 1;
        }
      }
      prevDateObj = currentDateObj;
    });
    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const hasLoggedToday = logs[todayStr] && logs[todayStr].completedIds.length > 0;
    const hasLoggedYesterday = logs[yesterdayStr] && logs[yesterdayStr].completedIds.length > 0;

    if (hasLoggedToday || hasLoggedYesterday) {
      let checkDateObj = hasLoggedToday ? new Date(todayStr + 'T00:00:00') : new Date(yesterdayStr + 'T00:00:00');
      while (true) {
        const checkDateStr = checkDateObj.toISOString().split('T')[0];
        if (logs[checkDateStr] && logs[checkDateStr].completedIds.length > 0) {
          currentStreak++;
          checkDateObj.setDate(checkDateObj.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const categoryCounts = {};
    const allCompletedIds = [];
    Object.values(logs).forEach(log => {
      allCompletedIds.push(...log.completedIds);
    });

    activities.forEach(act => {
      const completions = allCompletedIds.filter(id => id === act.id).length;
      categoryCounts[act.category] = (categoryCounts[act.category] || 0) + completions;
    });

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const log = logs[dateStr] || { completedIds: [] };
      const activeActivities = getActiveActivitiesForDate(activities, logs, dateStr);
      const score = calculateDailyScore(log.completedIds, activeActivities);
      
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      last7Days.push({
        date: dateStr,
        dayName,
        score,
        completedCount: log.completedIds.length
      });
    }

    res.json({
      currentStreak,
      maxStreak,
      dailyScores,
      categoryCounts,
      last7Days,
      totalActivities: activities.filter(act => !act.deleted).length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
