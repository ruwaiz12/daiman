const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
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
app.use(cors());

const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  console.log(`[Warning] Static client build files not found at: ${distPath}. Server running in API-only mode.`);
}

// API Routes
app.use('/api/categories', categoryRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/logs', dailyLogRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/analytics', analyticsRoutes);

// Fallback to static client build for any other path (Vite SPA compatibility)
app.get('*all', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'API Server is running. Frontend static build files not found.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
