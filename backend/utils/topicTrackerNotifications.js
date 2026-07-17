import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { ROLES } from './roles.js';
import { ALERT_SESSION_STATUSES } from './topicTrackerConstants.js';

const getAdminRecipients = async (actorId) =>
  User.find({
    role: ROLES.ADMIN,
    isActive: true,
    _id: { $ne: actorId },
  }).select('_id').lean();

const toDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const buildEntityPath = (entry) => {
  const isAlert = ALERT_SESSION_STATUSES.includes(entry.sessionStatus);
  if (isAlert && (entry.cancellationApprovalStatus === 'pending' || !entry.cancellationApprovalStatus || entry.cancellationApprovalStatus === 'none')) {
    const params = new URLSearchParams({
      tab: 'cancellations',
      entry: String(entry._id),
    });
    return `/topic-tracker?${params.toString()}`;
  }
  const params = new URLSearchParams({
    date: toDateKey(entry.date),
    subject: String(entry.subject),
    trainer: String(entry.trainer),
    schedule: String(entry.schedule),
    entry: String(entry._id),
  });
  return `/topic-tracker?${params.toString()}`;
};

export const notifyAdminsOfTopicTrackerUpdate = async (entry, actor) => {
  if (!actor?._id || actor.role === ROLES.ADMIN) return;

  const recipients = await getAdminRecipients(actor._id);
  if (!recipients.length) return;

  const location = [entry.courseName, entry.branchYearSection, entry.slot].filter(Boolean).join(' — ');
  const topic = entry.topicModuleCovered ? `; topic: ${entry.topicModuleCovered}` : '';
  const session = entry.sessionStatus ? `; session: ${entry.sessionStatus}` : '';
  const date = toDateKey(entry.date);
  const message = `${actor.name} updated topic tracker${location ? ` for ${location}` : ''}${
    date ? ` on ${date}` : ''
  }${topic}${session}`;

  await Notification.insertMany(
    recipients.map((recipient) => ({
      recipient: recipient._id,
      actor: actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'updated',
      resource: 'topic tracker entry',
      message,
      entityPath: buildEntityPath(entry),
    }))
  );
};

/**
 * Dedicated admin alert when a trainer newly marks a session cancelled or
 * postponed. Returns true when the alert was sent (caller can then skip the
 * generic update notification to avoid double noise).
 */
export const notifyAdminsOfSessionStatusAlert = async (entry, actor, previousStatus = '') => {
  if (!actor?._id || actor.role === ROLES.ADMIN) return false;

  const status = entry?.sessionStatus || '';
  if (!ALERT_SESSION_STATUSES.includes(status) || status === previousStatus) return false;

  const recipients = await getAdminRecipients(actor._id);
  if (!recipients.length) return false;

  const location = [entry.courseName, entry.branchYearSection, entry.slot].filter(Boolean).join(' — ');
  const date = toDateKey(entry.date);
  const message = `Session ${status}: ${actor.name} marked${location ? ` ${location}` : ' a session'}${
    date ? ` on ${date}` : ''
  } as ${status}`;

  await Notification.insertMany(
    recipients.map((recipient) => ({
      recipient: recipient._id,
      actor: actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'flagged',
      resource: 'session status',
      message,
      entityPath: buildEntityPath(entry),
    }))
  );
  return true;
};
