import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Trainer from '../models/Trainer.js';

export const formatPunchNotificationTime = (capturedAt) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).format(new Date(capturedAt));

export const notifyAdminOfPunch = async ({ user, capturedAt }) => {
  const [recipients, trainer] = await Promise.all([
    User.find({ role: 'admin', isActive: true, _id: { $ne: user._id } }).select('_id').lean(),
    Trainer.findById(user.trainer).select('name').lean(),
  ]);
  if (!recipients.length) return;
  const name = trainer?.name || user.name;
  const message = `${name} punched in at ${formatPunchNotificationTime(capturedAt)}`;
  await Notification.insertMany(recipients.map(recipient => ({ recipient: recipient._id,
    actor: user._id, actorName: name, actorRole: user.role, action: 'punched in',
    resource: 'attendance', message, entityPath: '/trainers?tab=logs' })));
};
