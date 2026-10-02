const Report = require('../models/Report');
const User = require('../models/User');
const Item = require('../models/Item');
const Notification = require('../models/Notification');

// Submit a flag against a user or item
async function createReport(req, res) {
  try {
    const reporterId = req.user._id || req.user.id;
    const { reportedUserId, itemId, reasonCategory, description } = req.body;

    if (!reportedUserId || !reasonCategory || !description) {
      return res.status(400).json({ message: 'Missing required report fields.' });
    }

    if (reporterId.toString() === reportedUserId.toString()) {
      return res.status(400).json({ message: 'You cannot report your own account.' });
    }

    const reportedExists = await User.exists({ _id: reportedUserId });
    if (!reportedExists) {
      return res.status(404).json({ message: 'The reported user could not be found.' });
    }

    // Prevent duplicate active reports for the same incident
    const existing = await Report.findOne({
      reporter: reporterId,
      reportedUser: reportedUserId,
      item: itemId || null,
      status: { $in: ['pending', 'investigating'] },
    });

    if (existing) {
      return res.status(400).json({ message: 'You already have an active pending report for this user/listing.' });
    }

    const report = await Report.create({
      reporter: reporterId,
      reportedUser: reportedUserId,
      item: itemId || null,
      reasonCategory,
      description,
    });

    res.status(201).json({ message: 'Report submitted successfully for review.', report });
  } catch (err) {
    console.error('createReport error:', err);
    res.status(500).json({ message: 'Failed to submit report.', error: err.message });
  }
}

// Get all reports (Admin only)
async function getReports(req, res) {
  try {
    const { status, category } = req.query;
    const filter = {};

    if (status && status !== 'all') filter.status = status;
    if (category && category !== 'all') filter.reasonCategory = category;

    const reports = await Report.find(filter)
      .populate('reporter', 'name email role')
      .populate('reportedUser', 'name email role strikeCount isSuspended')
      .populate('item', 'title category status type')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(reports);
  } catch (err) {
    console.error('getReports error:', err);
    res.status(500).json({ message: 'Failed to fetch reports.', error: err.message });
  }
}

// Resolve report & apply disciplinary actions (Admin only)
async function resolveReport(req, res) {
  try {
    const adminId = req.user._id || req.user.id;
    const { reportId } = req.params;
    const { status, actionTaken, adminNotes, incrementStrike, suspendUser, removeItem } = req.body;

    const VALID_STATUSES = ['pending', 'investigating', 'resolved', 'dismissed'];
    const VALID_ACTIONS = ['none', 'warning_issued', 'user_suspended', 'item_removed'];

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid report status.' });
    }
    if (actionTaken && !VALID_ACTIONS.includes(actionTaken)) {
      return res.status(400).json({ message: 'Invalid action.' });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    report.status = status || 'resolved';
    report.actionTaken = actionTaken || 'none';
    report.adminNotes = adminNotes || '';
    report.resolvedBy = adminId;

    const targetUser = await User.findById(report.reportedUser);
    let notifyMessage = null;

    if (targetUser) {
      let userChanged = false;

      if (incrementStrike) {
        targetUser.strikeCount = (targetUser.strikeCount || 0) + 1;
        userChanged = true;
        report.actionTaken = 'warning_issued';
        notifyMessage = `You received an official community strike. Current strikes: ${targetUser.strikeCount}/3.`;

        // Auto-suspend at 3 strikes
        if (targetUser.strikeCount >= 3) {
          targetUser.isSuspended = true;
          targetUser.suspensionReason = 'Account suspended due to receiving 3 conduct strikes.';
          report.actionTaken = 'user_suspended';
          notifyMessage = `Your account has been suspended: ${targetUser.suspensionReason}`;
        }
      }

      if (suspendUser) {
        targetUser.isSuspended = true;
        targetUser.suspensionReason = adminNotes || 'Account suspended for policy violation.';
        userChanged = true;
        report.actionTaken = 'user_suspended';
        notifyMessage = `Your account has been suspended: ${targetUser.suspensionReason}`;
      }

      if (userChanged) {
        await targetUser.save();
      }
    }

    if (removeItem && report.item) {
      await Item.findByIdAndUpdate(report.item, { status: 'closed' });
      if (report.actionTaken === 'none') report.actionTaken = 'item_removed';
      if (!notifyMessage && targetUser) {
        notifyMessage = 'One of your listings was removed by campus administration for violating community guidelines.';
      }
    }

    await report.save();

    // Only notify the reported user when something actually happened to them
    if (targetUser && notifyMessage) {
      await Notification.create({
        recipient: targetUser._id,
        sender: adminId,
        item: removeItem && report.item ? report.item : null,
        type: 'system_alert',
        message: notifyMessage,
      });
    }

    res.status(200).json({ message: 'Report resolved successfully.', report });
  } catch (err) {
    console.error('resolveReport error:', err);
    res.status(500).json({ message: 'Failed to resolve report.', error: err.message });
  }
}

module.exports = {
  createReport,
  getReports,
  resolveReport,
};