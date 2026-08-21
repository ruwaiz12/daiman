const DailyLog = require('../models/DailyLog');
const Activity = require('../models/Activity');

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

// Get log for a specific date
exports.getDailyLog = async (req, res) => {
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
};

// Save log for a specific date
exports.saveDailyLog = async (req, res) => {
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
};
