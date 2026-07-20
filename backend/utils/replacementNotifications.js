import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getLeaveDateKeysForWeekday, toLeaveDateKey } from './leaveDateRange.js';

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

export const buildAssignmentDateLabel = (leave, schedule, affectedDateKeys) => {
  const dateKeys = affectedDateKeys
    || getLeaveDateKeysForWeekday(leave, schedule?.day);
  const labels = dateKeys.map((key) => formatDateLabel(key));
  if (!labels.length) return buildDateRangeLabel(leave);

  const daySuffix = schedule?.day ? ` (${schedule.day})` : '';
  if (labels.length === 1) return `${labels[0]}${daySuffix}`;
  return `${labels.join(', ')}${daySuffix}`;
};

export const buildAssignmentDetail = (leave, schedule, affectedDateKeys) => {
  const dateLabel = buildAssignmentDateLabel(leave, schedule, affectedDateKeys);
  const classLabel = buildClassLabel(schedule);
  return [dateLabel, classLabel].filter(Boolean).join(' — ');
};

const getAssignmentTopicTrackerDateKey = (leave, schedule) => {
  const dateKeys = getLeaveDateKeysForWeekday(leave, schedule?.day);
  return dateKeys[0] || toLeaveDateKey(leave.startDate);
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

export const buildReplacementNotificationMessages = ({
  originalTrainerName,
  replacementTrainerName,
  previousReplacementTrainerName = '',
  detail,
}) => {
  const isReassignment = Boolean(previousReplacementTrainerName);

  if (!isReassignment) {
    return {
      replacement: `You were assigned to cover ${originalTrainerName}'s class: ${detail}`,
      original: `${replacementTrainerName} was assigned to cover your class: ${detail}`,
      previous: '',
    };
  }

  return {
    replacement: `You are now assigned to cover ${originalTrainerName}'s class, replacing ${previousReplacementTrainerName}: ${detail}`,
    original: `Your class replacement changed from ${previousReplacementTrainerName} to ${replacementTrainerName}: ${detail}`,
    previous: `You are no longer assigned to cover ${originalTrainerName}'s class. ${replacementTrainerName} is the new replacement: ${detail}`,
  };
};

export const buildReplacementCancellationMessages = ({
  originalTrainerName,
  detailLines = [],
}) => {
  const detailText = detailLines.filter(Boolean).join('; ');
  const assignmentWord = detailLines.length > 1 ? 'assignments' : 'assignment';
  const verb = detailLines.length > 1 ? 'were' : 'was';

  return {
    replacement: detailText
      ? `${originalTrainerName}'s leave was cancelled. Your replacement ${assignmentWord} ${verb} revoked: ${detailText}`
      : `${originalTrainerName}'s leave was cancelled. Your replacement ${assignmentWord} ${verb} revoked.`,
    original: detailText
      ? `Your leave was cancelled. Replacement ${assignmentWord} ${verb} revoked: ${detailText}`
      : 'Your leave was cancelled.',
  };
};

export const notifyReplacementCancellation = async ({
  actor,
  leave,
  originalTrainer,
  replacements = [],
}) => {
  if (!actor?._id || !originalTrainer?._id || !replacements.length) return;

  const assignmentsByReplacement = new Map();

  for (const entry of replacements) {
    const replacementTrainer = entry.replacementTrainer;
    const schedule = entry.schedule;
    if (!replacementTrainer?._id || !schedule?._id) continue;

    const replacementId = replacementTrainer._id.toString();
    const detailLine = buildAssignmentDetail(leave, schedule);
    if (!assignmentsByReplacement.has(replacementId)) {
      assignmentsByReplacement.set(replacementId, {
        trainer: replacementTrainer,
        detailLines: [],
      });
    }
    if (detailLine) {
      assignmentsByReplacement.get(replacementId).detailLines.push(detailLine);
    }
  }

  if (!assignmentsByReplacement.size) return;

  const usersByTrainer = await getTrainerUsers([
    originalTrainer._id,
    ...[...assignmentsByReplacement.keys()],
  ]);
  const base = notificationBase(actor);
  const notifications = [];
  const allDetailLines = [...new Set(
    [...assignmentsByReplacement.values()].flatMap((entry) => entry.detailLines)
  )];
  const originalMessages = buildReplacementCancellationMessages({
    originalTrainerName: originalTrainer.name,
    detailLines: allDetailLines,
  });

  for (const user of usersByTrainer.get(originalTrainer._id.toString()) || []) {
    notifications.push({
      ...base,
      recipient: user._id,
      action: 'cancelled',
      message: originalMessages.original,
      entityPath: '/replacements',
    });
  }

  for (const { trainer, detailLines } of assignmentsByReplacement.values()) {
    const messages = buildReplacementCancellationMessages({
      originalTrainerName: originalTrainer.name,
      detailLines,
    });
    for (const user of usersByTrainer.get(trainer._id.toString()) || []) {
      notifications.push({
        ...base,
        recipient: user._id,
        action: 'cancelled',
        message: messages.replacement,
        entityPath: '',
      });
    }
  }

  if (notifications.length) {
    await Notification.insertMany(notifications);
  }
};

export const notifyReplacementAssignment = async ({
  actor,
  leave,
  schedule,
  originalTrainer,
  replacementTrainer,
  previousReplacementTrainer = null,
  affectedDateKeys,
}) => {
  if (!actor?._id || !originalTrainer?._id || !replacementTrainer?.name) return;

  const isExternal = Boolean(replacementTrainer.isExternal) || !replacementTrainer._id;
  const previousId = previousReplacementTrainer?._id?.toString();
  const replacementId = replacementTrainer._id?.toString() || '';
  if (!isExternal && previousId && previousId === replacementId) return;

  const usersByTrainer = await getTrainerUsers([
    originalTrainer._id,
    !isExternal ? replacementTrainer._id : null,
    previousReplacementTrainer?._id,
  ]);

  const detail = buildAssignmentDetail(leave, schedule, affectedDateKeys);
  const dateKey = affectedDateKeys?.[0] || getAssignmentTopicTrackerDateKey(leave, schedule);
  const commonPath = `/topic-tracker?date=${encodeURIComponent(dateKey)}&schedule=${schedule._id}`;
  const base = notificationBase(actor);
  const notifications = [];
  const displayReplacementName = isExternal
    ? `${replacementTrainer.name} (external)`
    : replacementTrainer.name;
  const messages = buildReplacementNotificationMessages({
    originalTrainerName: originalTrainer.name,
    replacementTrainerName: displayReplacementName,
    previousReplacementTrainerName: previousReplacementTrainer?.name,
    detail,
  });

  if (!isExternal && replacementId) {
    for (const user of usersByTrainer.get(replacementId) || []) {
      notifications.push({
        ...base,
        recipient: user._id,
        action: 'assigned',
        message: messages.replacement,
        entityPath: `${commonPath}&trainer=${replacementId}`,
      });
    }
  }

  for (const user of usersByTrainer.get(originalTrainer._id.toString()) || []) {
    notifications.push({
      ...base,
      recipient: user._id,
      action: previousId ? 'changed' : 'assigned',
      message: messages.original,
      entityPath: `${commonPath}&trainer=${originalTrainer._id}`,
    });
  }

  if (previousId && previousId !== replacementId) {
    for (const user of usersByTrainer.get(previousId) || []) {
      notifications.push({
        ...base,
        recipient: user._id,
        action: 'unassigned',
        message: messages.previous,
        entityPath: '',
      });
    }
  }

  if (notifications.length) {
    await Notification.insertMany(notifications);
  }
};
