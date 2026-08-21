const Activity = require('../models/Activity');
const DailyLog = require('../models/DailyLog');

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

// Get detailed analytics and performance
exports.getAnalytics = async (req, res) => {
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
};
