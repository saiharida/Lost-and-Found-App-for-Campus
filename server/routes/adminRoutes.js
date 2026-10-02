const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  flagUser,
  getAllReportsAdmin,
  getFlaggedReportsAdmin,
  flagItemReport,
  removeReportAdmin,
  getOverdueItems,
  alertAllUsers,
  adminCreateReport,
} = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

// --- User Management (Admin Only) ---
router.get('/users', protect, requireAdmin, getAllUsers);
router.put('/users/:userId/flag', protect, requireAdmin, flagUser);

// --- Report / Item Moderation (Admin Only) ---
router.get('/reports', protect, requireAdmin, getAllReportsAdmin);
router.get('/reports/flagged', protect, requireAdmin, getFlaggedReportsAdmin);
router.delete('/reports/:itemId', protect, requireAdmin, removeReportAdmin);

// --- Overdue Items & Email Broadcast (Admin Only) ---
router.get('/overdue-items', protect, requireAdmin, getOverdueItems);
router.post('/alert-all', protect, requireAdmin, alertAllUsers);

// --- Admin Post Creation ---
router.post('/create-report', protect, requireAdmin, adminCreateReport);

// --- Student/User Action: Flag an Item Post ---
router.post('/items/:itemId/flag', protect, flagItemReport);

module.exports = router;