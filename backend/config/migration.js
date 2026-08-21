const fs = require('fs');
const path = require('path');
const Category = require('../models/Category');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const DailyLog = require('../models/DailyLog');

// Look for data files in backend/data/
const ACTIVITIES_FILE = path.join(__dirname, '..', 'data', 'activities.json');
const LOGS_FILE = path.join(__dirname, '..', 'data', 'logs.json');
const CATEGORIES_FILE = path.join(__dirname, '..', 'data', 'categories.json');
const GOALS_FILE = path.join(__dirname, '..', 'data', 'goals.json');

// Helper to read JSON files safely
function readJSON(filePath, defaultVal = []) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultVal;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || JSON.stringify(defaultVal));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultVal;
  }
}

async function migrateJSONToMongoDB() {
  try {
    const categoryCount = await Category.countDocuments();
    if (categoryCount > 0) {
      console.log('Database already populated, skipping migration.');
      return;
    }

    console.log('MongoDB database is empty. Checking for migration data files...');

    // 1. Migrate Categories
    if (fs.existsSync(CATEGORIES_FILE)) {
      const categories = readJSON(CATEGORIES_FILE, []);
      if (categories.length > 0) {
        const catDocs = categories.map(c => ({
          _id: c.id,
          name: c.name,
          icon: c.icon
        }));
        await Category.insertMany(catDocs);
        console.log(`Migrated ${categories.length} categories.`);
      }
    }

    // 2. Migrate Activities
    if (fs.existsSync(ACTIVITIES_FILE)) {
      const activities = readJSON(ACTIVITIES_FILE, []);
      if (activities.length > 0) {
        const actDocs = activities.map(a => ({
          _id: a.id,
          title: a.title,
          category: a.category,
          weight: a.weight,
          date: a.date || null,
          time: a.time || null,
          deleted: a.deleted || false,
          deletedAt: a.deletedAt ? new Date(a.deletedAt) : null,
          createdAt: a.createdAt ? new Date(a.createdAt) : new Date()
        }));
        await Activity.insertMany(actDocs);
        console.log(`Migrated ${activities.length} activities.`);
      }
    }

    // 3. Migrate Goals
    if (fs.existsSync(GOALS_FILE)) {
      const goals = readJSON(GOALS_FILE, []);
      if (goals.length > 0) {
        const goalDocs = goals.map(g => ({
          _id: g.id,
          title: g.title,
          category: g.category,
          targetDate: g.targetDate,
          progress: g.progress || 0,
          createdAt: g.createdAt ? new Date(g.createdAt) : new Date()
        }));
        await Goal.insertMany(goalDocs);
        console.log(`Migrated ${goals.length} goals.`);
      }
    }

    // 4. Migrate Daily Logs
    if (fs.existsSync(LOGS_FILE)) {
      const logs = readJSON(LOGS_FILE, {});
      const logDates = Object.keys(logs);
      if (logDates.length > 0) {
        const logDocs = logDates.map(dateStr => {
          const l = logs[dateStr];
          const finance = l.finance || { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] };
          return {
            _id: dateStr,
            activeIds: Array.isArray(l.activeIds) ? l.activeIds : [],
            completedIds: Array.isArray(l.completedIds) ? l.completedIds : [],
            notes: l.notes || '',
            mood: l.mood || 0,
            finance: {
              income: finance.income || 0,
              expense: finance.expense || 0,
              debt: finance.debt || 0,
              receivable: finance.receivable || 0,
              transactions: Array.isArray(finance.transactions) ? finance.transactions.map(tx => ({
                id: tx.id,
                desc: tx.desc,
                amount: tx.amount,
                type: tx.type
              })) : []
            },
            updatedAt: l.updatedAt ? new Date(l.updatedAt) : new Date()
          };
        });
        await DailyLog.insertMany(logDocs);
        console.log(`Migrated ${logDocs.length} daily logs.`);
      }
    }

    console.log('Data migration completed successfully!');
  } catch (err) {
    console.error('Error migrating data to MongoDB:', err);
  }
}

module.exports = migrateJSONToMongoDB;
