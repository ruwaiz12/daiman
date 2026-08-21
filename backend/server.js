const express = require('express');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db');
const migrateJSONToMongoDB = require('./config/migration');

// Import routes
const categoryRoutes = require('./routes/categoryRoutes');
const activityRoutes = require('./routes/activityRoutes');
const dailyLogRoutes = require('./routes/dailyLogRoutes');
const goalRoutes = require('./routes/goalRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database & Migrate
connectDB().then(async () => {
  await migrateJSONToMongoDB();
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// API Routes
app.use('/api/categories', categoryRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/logs', dailyLogRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/analytics', analyticsRoutes);

// Fallback to static client build for any other path (Vite SPA compatibility)
app.get('*all', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
