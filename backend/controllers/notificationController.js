import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    readAt: null,
  });

  res.json({ notifications, unreadCount });
};

export const markNotificationRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    readAt: null,
  });

  res.json({ notification, unreadCount });
};

export const markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );

  res.json({ unreadCount: 0 });
};
