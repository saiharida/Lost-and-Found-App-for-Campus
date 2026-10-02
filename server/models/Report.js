const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
    },
    reasonCategory: {
      type: String,
      enum: [
        'fraudulent_claim',
        'fake_item',
        'inappropriate_content',
        'harassment',
        'spam',
        'other',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'dismissed'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actionTaken: {
      type: String,
      enum: ['none', 'warning_issued', 'user_suspended', 'item_removed'],
      default: 'none',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);