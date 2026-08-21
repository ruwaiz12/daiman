const mongoose = require('mongoose');

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

module.exports = mongoose.model('Activity', ActivitySchema);
