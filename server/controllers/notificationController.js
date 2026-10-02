const Notification = require('../models/Notification');

async function getNotifications(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'name email')
      .populate('item', 'title type')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications.', error: err.message });
  }
}

async function markAsRead(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: userId },
      { isRead: true },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Notification not found.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update notification.', error: err.message });
  }
}

async function markAllAsRead(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update notifications.', error: err.message });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};