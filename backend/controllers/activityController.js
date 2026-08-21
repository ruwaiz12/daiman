const Activity = require('../models/Activity');
const DailyLog = require('../models/DailyLog');

// Mapping helper
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

// Get all activities
exports.getActivities = async (req, res) => {
  try {
    const activities = await Activity.find();
    res.json(activities.map(mapActivity));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activities.' });
  }
};

// Add activity
exports.createActivity = async (req, res) => {
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
};

// Update activity
exports.updateActivity = async (req, res) => {
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
};

// Delete activity (Soft-Delete & Logs cleanup for current/future dates)
exports.deleteActivity = async (req, res) => {
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
};
