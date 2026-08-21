const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // custom ID (e.g. 'goal-...')
  title: { type: String, required: true },
  category: { type: String, required: true },
  targetDate: { type: String, required: true },
  progress: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('Goal', GoalSchema);
