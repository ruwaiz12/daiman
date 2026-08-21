const Goal = require('../models/Goal');

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

// Get all goals
exports.getGoals = async (req, res) => {
  try {
    const goals = await Goal.find();
    res.json(goals.map(mapGoal));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch goals.' });
  }
};

// Add a goal
exports.createGoal = async (req, res) => {
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
};

// Update a goal
exports.updateGoal = async (req, res) => {
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
};

// Delete a goal
exports.deleteGoal = async (req, res) => {
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
};
