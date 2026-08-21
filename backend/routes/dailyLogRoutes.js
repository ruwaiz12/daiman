const express = require('express');
const router = express.Router();
const dailyLogController = require('../controllers/dailyLogController');

router.get('/:date', dailyLogController.getDailyLog);
router.post('/:date', dailyLogController.saveDailyLog);

module.exports = router;
