import Notification from '../models/Notification.js';
import User from '../models/User.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatMonthLabel = (monthKey) => {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(monthKey || '');
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return String(monthKey);
  return `${MONTH_NAMES[monthIndex]} ${match[1]}`;
};

const truncate = (text, max = 140) => {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
};

export const buildObservationClassDetail = ({
  department = '',
  section = '',
  slot = '',
  startTime = '',
  endTime = '',
  day = '',
  subjectCode = '',
  observationDate = '',
} = {}) => {
  const className = [department, section].filter(Boolean).join(' ');
  const time = [startTime, endTime].filter(Boolean).join('–');
  const slotPart = slot ? (time ? `${slot} ${time}` : slot) : time;
  return [observationDate, subjectCode, className, day, slotPart].filter(Boolean).join(' · ');
};

/**
 * Notify the trainer about observation comments only (never include rating).
 */
export const notifyTrainerOfObservationComments = async ({
  actor,
  trainer,
  type,
  comments,
  monthKey,
  classDetail = '',
}) => {
  const trimmed = String(comments || '').trim();
  if (!actor?._id || !trainer?._id || !trimmed) return;

  const users = await User.find({
    trainer: trainer._id,
    isActive: true,
  }).select('_id').lean();
  if (!users.length) return;

  const monthLabel = formatMonthLabel(monthKey);
  const kind = type === 'class' ? 'class observation' : 'demo observation';
  const detail = classDetail ? ` (${classDetail})` : '';
  const message = `${actor.name} shared ${kind} comments for ${monthLabel}${detail}: ${truncate(trimmed)}`;

  await Notification.insertMany(
    users.map((user) => ({
      recipient: user._id,
      actor: actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'commented',
      resource: 'observation',
      message,
      entityPath: '',
    }))
  );
};
