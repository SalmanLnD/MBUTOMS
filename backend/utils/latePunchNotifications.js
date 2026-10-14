import Notification from '../models/Notification.js';
import User from '../models/User.js';

const formatDateLabel = (dateKey) => {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return dateKey || 'that day';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

export const buildLateMarkMessage = ({ decision, dateKey }) => {
  const label = formatDateLabel(dateKey);
  if (decision === 'warning') {
    return `Your punch on ${label} after 8:40 was marked as a warning. This is the first late mark this month.`;
  }
  if (decision === 'misconduct') {
    return `Your punch on ${label} after 8:40 was marked as late misconduct. 1 compliance point was added.`;
  }
  return '';
};

export const notifyTrainerOfLateMark = async ({ trainerId, decision, dateKey, actor }) => {
  const message = buildLateMarkMessage({ decision, dateKey });
  if (!message || !trainerId || !actor?._id) return;

  const users = await User.find({ trainer: trainerId, isActive: true }).select('_id').lean();
  if (!users.length) return;

  await Notification.insertMany(users.map((user) => ({
    recipient: user._id,
    actor: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    action: decision === 'misconduct' ? 'compliance' : 'warning',
    resource: 'late punch',
    message,
    entityPath: '/trainers?tab=logs',
  })));
};
