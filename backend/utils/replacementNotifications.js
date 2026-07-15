import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { toLeaveDateKey } from './leaveDateRange.js';

const formatDateLabel = (dateInput) => {
  const key = toLeaveDateKey(dateInput);
  if (!key) return '';
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

const buildDateRangeLabel = (leave) => {
  const start = formatDateLabel(leave.startDate);
  const end = formatDateLabel(leave.endDate);
  return start === end ? start : `${start} to ${end}`;
};

const buildClassLabel = (schedule) => {
  const className = [schedule.department, schedule.section].filter(Boolean).join(' ');
  const time = [schedule.startTime, schedule.endTime].filter(Boolean).join('–');
  return [className, time].filter(Boolean).join(', ');
};

const getTrainerUsers = async (trainerIds) => {
  const ids = [...new Set(trainerIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();

  const users = await User.find({
    trainer: { $in: ids },
    isActive: true,
  }).select('_id trainer').lean();

  const byTrainer = new Map();
  for (const user of users) {
    const key = user.trainer?.toString();
    if (!key) continue;
    if (!byTrainer.has(key)) byTrainer.set(key, []);
    byTrainer.get(key).push(user);
  }
  return byTrainer;
};

const notificationBase = (actor) => ({
  actor: actor._id,
  actorName: actor.name,
  actorRole: actor.role,
  resource: 'replacement',
  entityPath: '/topic-tracker',
});

export const notifyReplacementAssignment = async ({
  actor,
  leave,
  schedule,
  originalTrainer,
  replacementTrainer,
  previousReplacementTrainer = null,
}) => {
  if (!actor?._id || !originalTrainer?._id || !replacementTrainer?._id) return;

  const previousId = previousReplacementTrainer?._id?.toString();
  const replacementId = replacementTrainer._id.toString();
  if (previousId === replacementId) return;

  const usersByTrainer = await getTrainerUsers([
    originalTrainer._id,
    replacementTrainer._id,
    previousReplacementTrainer?._id,
  ]);

  const dateLabel = buildDateRangeLabel(leave);
  const classLabel = buildClassLabel(schedule);
  const detail = [dateLabel, classLabel].filter(Boolean).join(' — ');
  const dateKey = toLeaveDateKey(leave.startDate);
  const commonPath = `/topic-tracker?date=${encodeURIComponent(dateKey)}&schedule=${schedule._id}`;
  const base = notificationBase(actor);
  const notifications = [];

  for (const user of usersByTrainer.get(replacementId) || []) {
    notifications.push({
      ...base,
      recipient: user._id,
      action: 'assigned',
      message: `You were assigned to cover ${originalTrainer.name}'s class: ${detail}`,
      entityPath: `${commonPath}&trainer=${replacementId}`,
    });
  }

  for (const user of usersByTrainer.get(originalTrainer._id.toString()) || []) {
    notifications.push({
      ...base,
      recipient: user._id,
      action: 'assigned',
      message: `${replacementTrainer.name} was assigned to cover your class: ${detail}`,
      entityPath: `${commonPath}&trainer=${originalTrainer._id}`,
    });
  }

  if (previousId && previousId !== replacementId) {
    for (const user of usersByTrainer.get(previousId) || []) {
      notifications.push({
        ...base,
        recipient: user._id,
        action: 'unassigned',
        message: `Your replacement assignment for ${originalTrainer.name}'s class was changed: ${detail}`,
        entityPath: '',
      });
    }
  }

  if (notifications.length) {
    await Notification.insertMany(notifications);
  }
};
