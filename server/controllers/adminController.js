const User = require('../models/User');
const Item = require('../models/Item');
const sendEmail = require('../utils/sendEmail');

// Fetch all registered users with strike and suspension filters
async function getAllUsers(req, res) {
  try {
    const { search, filter } = req.query;
    const query = {};

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(),$options: 'i' } },
        { email: { $regex: search.trim(),$options: 'i' } },
      ];
    }

    if (filter === 'suspended') {
      query.isSuspended = true;
    } else if (filter === 'flagged') {
      query.strikeCount = { $gt: 0 };
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ strikeCount: -1, createdAt: -1 })
      .lean();

    res.status(200).json(users);
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ message: 'Failed to fetch campus users.', error: err.message });
  }
}

// Admin action: issue strike, clear strike, suspend, or unsuspend
async function flagUser(req, res) {
  try {
    const { userId } = req.params;
    const { action, reason } = req.body; 

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (targetUser.role === 'admin') {
      return res.status(400).json({ message: 'Cannot apply disciplinary flags on an administrator.' });
    }

    if (action === 'add_strike') {
      targetUser.strikeCount = (targetUser.strikeCount || 0) + 1;

      if (targetUser.strikeCount >= 3) {
        targetUser.isSuspended = true;
        targetUser.suspensionReason = reason?.trim() || 'Account suspended automatically after receiving 3 conduct strikes.';
      }
    } else if (action === 'remove_strike') {
      targetUser.strikeCount = Math.max(0, (targetUser.strikeCount || 0) - 1);
    } else if (action === 'suspend') {
      targetUser.isSuspended = true;
      targetUser.suspensionReason = reason?.trim() || 'Account suspended by campus administration.';
    } else if (action === 'unsuspend') {
      targetUser.isSuspended = false;
      targetUser.suspensionReason = '';
    } else {
      return res.status(400).json({ message: 'Invalid moderation action.' });
    }

    await targetUser.save();

    res.status(200).json({
      message: 'User status successfully updated.',
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        strikeCount: targetUser.strikeCount,
        isSuspended: targetUser.isSuspended,
        suspensionReason: targetUser.suspensionReason,
      },
    });
  } catch (err) {
    console.error('flagUser error:', err);
    res.status(500).json({ message: 'Failed to update user moderation status.', error: err.message });
  }
}

// 1. Admin: View all reports/items with detailed user info (date, title, description, location, user mail, name, designation)
async function getAllReportsAdmin(req, res) {
  try {
    const items = await Item.find({})
      .populate('reportedBy', 'name email role phone')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(items);
  } catch (err) {
    console.error('getAllReportsAdmin error:', err);
    res.status(500).json({ message: 'Failed to fetch items for admin.', error: err.message });
  }
}

// 2. Admin: View flagged reports separately (items with flagCount > 0)
async function getFlaggedReportsAdmin(req, res) {
  try {
    const flaggedItems = await Item.find({ flagCount: { $gt: 0 } })
      .populate('reportedBy', 'name email role strikeCount')
      .populate('flags.user', 'name email')
      .sort({ flagCount: -1, createdAt: -1 })
      .lean();

    res.status(200).json(flaggedItems);
  } catch (err) {
    console.error('getFlaggedReportsAdmin error:', err);
    res.status(500).json({ message: 'Failed to fetch flagged items.', error: err.message });
  }
}

// 3. User / Student action: Flag a malicious or fake post
async function flagItemReport(req, res) {
  try {
    const { itemId } = req.params;
    const userId = req.user._id; // from auth middleware

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item report not found.' });
    }

    // Check if user already flagged this item
    const alreadyFlagged = item.flags.some((f) => f.user.toString() === userId.toString());
    if (alreadyFlagged) {
      return res.status(400).json({ message: 'You have already flagged this report.' });
    }

    item.flags.push({ user: userId });
    item.flagCount = item.flags.length;
    await item.save();

    // If item hits 3 or more flags, automatically issue a strike to the user who posted it
    if (item.flagCount >= 3) {
      const author = await User.findById(item.reportedBy);
      if (author && author.role !== 'admin') {
        author.strikeCount = (author.strikeCount || 0) + 1;
        if (author.strikeCount >= 3) {
          author.isSuspended = true;
          author.suspensionReason = 'Account automatically suspended because multiple posts received flags.';
        }
        await author.save();
      }
    }

    res.status(200).json({ message: 'Report flagged successfully.', flagCount: item.flagCount });
  } catch (err) {
    console.error('flagItemReport error:', err);
    res.status(500).json({ message: 'Failed to flag report.', error: err.message });
  }
}

// 4. Admin: Remove a flagged report and penalize poster if needed
async function removeReportAdmin(req, res) {
  try {
    const { itemId } = req.params;
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const authorId = item.reportedBy;
    await Item.findByIdAndDelete(itemId);

    // Increment strike count for the user whose post was removed
    const author = await User.findById(authorId);
    if (author && author.role !== 'admin') {
      author.strikeCount = (author.strikeCount || 0) + 1;
      if (author.strikeCount >= 3) {
        author.isSuspended = true;
        author.suspensionReason = 'Account suspended due to administrator removing flagged/malicious posts.';
      }
      await author.save();
    }

    res.status(200).json({ message: 'Report removed and user penalized successfully.' });
  } catch (err) {
    console.error('removeReportAdmin error:', err);
    res.status(500).json({ message: 'Failed to remove report.', error: err.message });
  }
}

// 5. Admin: See items not handed over for more than 3 days & Broadcast "Alert All" Email
async function getOverdueItems(req, res) {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    // Find found items that are still active/unclaimed after 3 days
    const overdueItems = await Item.find({
      type: 'found',
      status: 'active',
      createdAt: { $lte: threeDaysAgo },
    })
      .populate('reportedBy', 'name email designation')
      .lean();

    res.status(200).json(overdueItems);
  } catch (err) {
    console.error('getOverdueItems error:', err);
    res.status(500).json({ message: 'Failed to fetch overdue items.', error: err.message });
  }
}

async function alertAllUsers(req, res) {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required.' });
    }

    // Fetch all active, non-suspended users' emails
    const users = await User.find({ isSuspended: false }).select('email').lean();
    const emails = users.map((u) => u.email).filter(Boolean);

    if (emails.length === 0) {
      return res.status(400).json({ message: 'No recipient emails found.' });
    }

    // Send email using your sendEmail utility (bcc or loop)
    for (const email of emails) {
      await sendEmail({
        email,
        subject: `[Campus Alert] ${subject}`,
        message,
      });
    }

    res.status(200).json({ message: `Alert broadcasted successfully to ${emails.length} users.` });
  } catch (err) {
    console.error('alertAllUsers error:', err);
    res.status(500).json({ message: 'Failed to broadcast alert email.', error: err.message });
  }
}

// 6. Admin: Post a lost/found report directly (e.g., items handed over to library/admin staff)
async function adminCreateReport(req, res) {
  try {
    const { type, title, description, category, location, dateOccurred, contactInfo, imageUrl } = req.body;
    
    const newItem = await Item.create({
      type,
      title,
      description,
      category,
      location,
      dateOccurred: dateOccurred || Date.now(),
      contactInfo,
      imageUrl,
      reportedBy: req.user._id, // Admin's user ID
      status: 'active',
    });

    res.status(201).json({ message: 'Admin report posted successfully.', item: newItem });
  } catch (err) {
    console.error('adminCreateReport error:', err);
    res.status(500).json({ message: 'Failed to create report.', error: err.message });
  }
}

module.exports = {
  getAllUsers,
  flagUser,
  getAllReportsAdmin,
  getFlaggedReportsAdmin,
  flagItemReport,
  removeReportAdmin,
  getOverdueItems,
  alertAllUsers,
  adminCreateReport,
};