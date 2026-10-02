const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['lost', 'found'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      default: '',
    },
    dateOccurred: {
      type: Date,
      default: Date.now,
    },
    contactInfo: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: null,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'claimed', 'handed_over', 'closed'],
      default: 'active',
    },
    // New fields for flagging system
    flags: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    flagCount: {
      type: Number,
      default: 0,
    },
    claims: [
      {
        claimant: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        claimedAt: {
          type: Date,
          default: Date.now,
        },
        question: {
          type: String,
          default: '',
        },
        answer: {
          type: String,
          default: '',
        },
        status: {
          type: String,
          enum: ['pending', 'rejected', 'verified'],
          default: 'pending',
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);