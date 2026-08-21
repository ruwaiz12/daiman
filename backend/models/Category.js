const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  _id: { type: String, required: true }, // custom ID (e.g. 'cat-health')
  name: { type: String, required: true },
  icon: { type: String, required: true }
}, { _id: false });

module.exports = mongoose.model('Category', CategorySchema);
