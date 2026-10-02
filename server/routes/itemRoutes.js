const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/authMiddleware');
const {
  createItem,
  getItems,
  getMyItems,
  getMyClaims,
  getItemById,
  getPotentialMatches,
  claimItem,
  askVerificationQuestion,
  answerVerificationQuestion,
  verifyClaim,
  rejectClaim,
  updateItem,
  deleteItem,
} = require('../controllers/itemController');

// Collection routes
router.get('/', getItems);
router.post('/', protect, upload.single('image'), createItem);
router.get('/mine', protect, getMyItems);
router.get('/claims', protect, getMyClaims);

// Match route
router.get('/:id/matches', getPotentialMatches);

// Claims & Verification workflows (MUST be before or alongside :id CRUD)
router.post('/:id/claim', protect, claimItem);
router.post('/:id/ask-question', protect, askVerificationQuestion);
router.post('/:id/answer-question', protect, answerVerificationQuestion);
router.post('/:id/verify-claim', protect, verifyClaim);
router.post('/:id/reject-claim', protect, rejectClaim);

// Standard Item CRUD
router.get('/:id', getItemById);
router.put('/:id', protect, upload.single('image'), updateItem);
router.delete('/:id', protect, deleteItem);

module.exports = router;