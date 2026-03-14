const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getKpis, getOperationsSummary, getAlerts } = require('../controllers/dashboardController');

router.use(protect);

// @route   GET /api/dashboard/kpis
router.get('/kpis', getKpis);

// @route   GET /api/dashboard/operations-summary
router.get('/operations-summary', getOperationsSummary);

// @route   GET /api/dashboard/alerts
router.get('/alerts', getAlerts);

module.exports = router;
