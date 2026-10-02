const express = require('express');
const router = express.Router();
const {
  createReport,
  getReports,
  resolveReport,
} = require('../controllers/reportController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

// Any logged-in user can submit a report
router.post('/', protect, createReport);

// Admin-only review endpoints
router.get('/', protect, requireAdmin, getReports);
router.put('/:reportId/resolve', protect, requireAdmin, resolveReport);

module.exports = router;