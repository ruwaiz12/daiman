const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ACTIVITIES_FILE = path.join(__dirname, 'data', 'activities.json');
const LOGS_FILE = path.join(__dirname, 'data', 'logs.json');
const CATEGORIES_FILE = path.join(__dirname, 'data', 'categories.json');
const GOALS_FILE = path.join(__dirname, 'data', 'goals.json');

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

// -------------------------------------------------------------
// Categories API
// -------------------------------------------------------------

// Get all categories
app.get('/api/categories', (req, res) => {
  const categories = readJSON(CATEGORIES_FILE, []);
  res.json(categories);
});

// Add a category
app.post('/api/categories', (req, res) => {
  const { name, icon } = req.body;
  if (!name || !icon) {
    return res.status(400).json({ error: 'Name and icon are required.' });
  }

  const categories = readJSON(CATEGORIES_FILE, []);
  
  // Prevent duplicate names
  const normalized = name.toLowerCase().trim();
  if (categories.some(c => c.name.toLowerCase().trim() === normalized)) {
    return res.status(400).json({ error: 'Category already exists.' });
  }

  const newCategory = {
    id: 'cat-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    name: name.trim(),
    icon: icon.trim()
  };

  categories.push(newCategory);
  writeJSON(CATEGORIES_FILE, categories);
  res.status(201).json(categories);
});


// -------------------------------------------------------------
// Activities CRUD
// -------------------------------------------------------------

// Get all activities
app.get('/api/activities', (req, res) => {
  const activities = readJSON(ACTIVITIES_FILE, []);
  res.json(activities);
});

// Add activity
app.post('/api/activities', (req, res) => {
  const { title, category, weight, date, time } = req.body;
  if (!title || !category || !weight) {
    return res.status(400).json({ error: 'Title, category, and weight are required.' });
  }

  const activities = readJSON(ACTIVITIES_FILE, []);
  const newActivity = {
    id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    title,
    category,
    weight,
    date: date || null, // null/undefined means recurring
    time: time || null, // null/undefined means untimed
    createdAt: new Date().toISOString()
  };

  activities.push(newActivity);
  writeJSON(ACTIVITIES_FILE, activities);
  res.status(201).json(activities);
});

// Update activity
app.put('/api/activities/:id', (req, res) => {
  const { id } = req.params;
  const { title, category, weight, date, time } = req.body;

  const activities = readJSON(ACTIVITIES_FILE, []);
  const index = activities.findIndex(a => a.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Activity not found.' });
  }

  activities[index] = {
    ...activities[index],
    title: title || activities[index].title,
    category: category || activities[index].category,
    weight: weight || activities[index].weight,
    date: date !== undefined ? date : activities[index].date,
    time: time !== undefined ? time : activities[index].time
  };

  writeJSON(ACTIVITIES_FILE, activities);
  res.json(activities);
});

// Delete activity
app.delete('/api/activities/:id', (req, res) => {
  const { id } = req.params;
  let activities = readJSON(ACTIVITIES_FILE, []);
  
  const exists = activities.some(a => a.id === id);
  if (!exists) {
    return res.status(404).json({ error: 'Activity not found.' });
  }

  activities = activities.filter(a => a.id !== id);
  writeJSON(ACTIVITIES_FILE, activities);
  res.json(activities);
});


// -------------------------------------------------------------
// Daily Logs (with Finance tracking support)
// -------------------------------------------------------------

// Get log for a specific date
app.get('/api/logs/:date', (req, res) => {
  const { date } = req.params; // Expect YYYY-MM-DD
  const logs = readJSON(LOGS_FILE, {});
  const activities = readJSON(ACTIVITIES_FILE, []);
  
  const log = logs[date] || { completedIds: [], notes: '', mood: 0 };
  
  // If activeIds is missing from the stored day log, seed it with the default schedule for that day
  if (!Array.isArray(log.activeIds)) {
    const defaultActive = getActiveActivitiesForDate(activities, logs, date);
    log.activeIds = defaultActive.map(act => act.id);
  }

  // Populate finance ledger placeholders if missing
  if (!log.finance) {
    log.finance = { income: 0, expense: 0, transactions: [] };
  }
  
  res.json(log);
});

// Save log for a specific date
app.post('/api/logs/:date', (req, res) => {
  const { date } = req.params;
  const { completedIds, activeIds, notes, mood, finance } = req.body;

  if (!Array.isArray(completedIds)) {
    return res.status(400).json({ error: 'completedIds must be an array.' });
  }

  const logs = readJSON(LOGS_FILE, {});
  logs[date] = {
    activeIds: Array.isArray(activeIds) ? activeIds : [],
    completedIds,
    notes: notes || '',
    mood: mood || 0,
    finance: finance || { income: 0, expense: 0, transactions: [] },
    updatedAt: new Date().toISOString()
  };

  writeJSON(LOGS_FILE, logs);
  res.json({ success: true, log: logs[date] });
});


// -------------------------------------------------------------
// Life Goals & Milestones API
// -------------------------------------------------------------

// Get all goals
app.get('/api/goals', (req, res) => {
  const goals = readJSON(GOALS_FILE, []);
  res.json(goals);
});

// Add a goal
app.post('/api/goals', (req, res) => {
  const { title, category, targetDate, progress } = req.body;
  if (!title || !category || !targetDate) {
    return res.status(400).json({ error: 'Title, category, and target date are required.' });
  }

  const goals = readJSON(GOALS_FILE, []);
  const newGoal = {
    id: 'goal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    title: title.trim(),
    category,
    targetDate,
    progress: progress !== undefined ? parseInt(progress) : 0,
    createdAt: new Date().toISOString()
  };

  goals.push(newGoal);
  writeJSON(GOALS_FILE, goals);
  res.status(201).json(goals);
});

// Update a goal
app.put('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  const { title, category, targetDate, progress } = req.body;

  const goals = readJSON(GOALS_FILE, []);
  const index = goals.findIndex(g => g.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Goal not found.' });
  }

  goals[index] = {
    ...goals[index],
    title: title !== undefined ? title.trim() : goals[index].title,
    category: category !== undefined ? category : goals[index].category,
    targetDate: targetDate !== undefined ? targetDate : goals[index].targetDate,
    progress: progress !== undefined ? parseInt(progress) : goals[index].progress
  };

  writeJSON(GOALS_FILE, goals);
  res.json(goals);
});

// Delete a goal
app.delete('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  let goals = readJSON(GOALS_FILE, []);
  
  const exists = goals.some(g => g.id === id);
  if (!exists) {
    return res.status(404).json({ error: 'Goal not found.' });
  }

  goals = goals.filter(g => g.id !== id);
  writeJSON(GOALS_FILE, goals);
  res.json(goals);
});


// -------------------------------------------------------------
// Analytics
// -------------------------------------------------------------

// Get detailed analytics and performance
app.get('/api/analytics', (req, res) => {
  const activities = readJSON(ACTIVITIES_FILE, []);
  const logs = readJSON(LOGS_FILE, {});

  // 1. Calculate historical performance scores for each logged day using active activities for that day
  const dailyScores = {};
  Object.keys(logs).forEach(date => {
    const activeActivities = getActiveActivitiesForDate(activities, logs, date);
    dailyScores[date] = calculateDailyScore(logs[date].completedIds, activeActivities);
  });

  // 2. Streaks calculation
  // A streak day is defined as a day with at least one completed activity.
  const loggedDates = Object.keys(logs)
    .filter(date => logs[date].completedIds.length > 0)
    .sort();

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  let prevDateObj = null;

  // Find max streak
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

  // Calculate current streak relative to today
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // If today or yesterday is logged with some completions, trace backwards
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

  // 3. Category Breakdown (Total completions per category all-time)
  const categoryCounts = {};
  const allCompletedIds = [];
  Object.values(logs).forEach(log => {
    allCompletedIds.push(...log.completedIds);
  });

  activities.forEach(act => {
    const completions = allCompletedIds.filter(id => id === act.id).length;
    categoryCounts[act.category] = (categoryCounts[act.category] || 0) + completions;
  });

  // 4. Monthly/Weekly completion summary (last 7 days)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const log = logs[dateStr] || { completedIds: [] };
    const activeActivities = getActiveActivitiesForDate(activities, logs, dateStr);
    const score = calculateDailyScore(log.completedIds, activeActivities);
    
    // Day name short (e.g. Mon, Tue)
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
    totalActivities: activities.length
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
