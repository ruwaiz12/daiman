const mongoose = require('mongoose');

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

module.exports = mongoose.model('DailyLog', DailyLogSchema);
