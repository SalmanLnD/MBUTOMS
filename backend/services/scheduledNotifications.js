import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getIstNowParts } from '../utils/liveTrainerVenues.js';
import { buildTopicTrackerSessions } from '../utils/topicTrackerSessions.js';
import { FEEDBACK_ANNOUNCEMENT } from '../utils/feedbackAnnouncement.js';

export const scheduledNotificationId = (key) => new mongoose.Types.ObjectId(createHash('sha256').update(key).digest('hex').slice(0, 24));
export const createNotificationOnce = async (key, data, model = Notification) => {
  try { await model.create({ ...data, _id: scheduledNotificationId(key) }); return true; }
  catch (error) { if (error.code === 11000) return false; throw error; }
};
const getActor = async () => User.findOne({ role: 'admin', isActive: true }).select('_id name role').lean();
export const publishFeedbackAnnouncement = async (deps = {}) => {
  const actor = await (deps.actor || getActor)();
  if (!actor) return { sent: 0 };
  const users = await (deps.users || (() => User.find({ isActive: true, role: { $ne: 'demo' } }).select('_id').lean()))();
  let sent = 0;
  for (const user of users) if (await (deps.create || createNotificationOnce)(`announcement:${FEEDBACK_ANNOUNCEMENT.id}:${user._id}`, {
    recipient: user._id, actor: actor._id, actorName: actor.name, actorRole: actor.role,
    action: 'announced', resource: 'TOMS announcement', message: 'Your feedback has helped shape TOMS! Tap to read our updates and a little thank-you from Salman. 💙',
    entityPath: `/dashboard?announcement=${FEEDBACK_ANNOUNCEMENT.id}`,
  })) sent++;
  return { sent };
};

export const groupPendingTrackerSessions = (sessions = []) => {
  const groups = new Map();
  for (const session of sessions) {
    if (session.trackerStatus === 'closed') continue;
    // Campus replacements own the reminder; external replacements have no account.
    if (session.isReplacementAssignment && !session.replacementTrainerId) continue;
    const trainer = String(session.replacementTrainerId || session.trainerId || '');
    if (!trainer) continue;
    if (!groups.has(trainer)) groups.set(trainer, new Map());
    groups.get(trainer).set(String(session.scheduleId), session);
  }
  return new Map([...groups].map(([trainer, slots]) => [trainer, [...slots.values()]]));
};
export const sendTopicTrackerReminders = async (now = new Date(), deps = {}) => {
  const clock = getIstNowParts(now);
  if (clock.minutes < 18 * 60) return { sent: 0, skipped: true };
  const actor = await (deps.actor || getActor)();
  if (!actor) return { sent: 0, skipped: true };
  const { sessions } = await (deps.sessions || buildTopicTrackerSessions)({ date: clock.dateKey, user: { role: 'admin' }, lite: true });
  const groups = groupPendingTrackerSessions(sessions);
  if (!groups.size) return { sent: 0, date: clock.dateKey };
  const users = await (deps.users || (() => User.find({ isActive: true, role: { $ne: 'demo' }, $or: [
    { trainer: { $in: [...groups.keys()] } }, { role: { $in: ['admin', 'manager', 'campus_manager'] }, assistantTrainer: { $in: [...groups.keys()] } },
  ] }).select('_id trainer assistantTrainer role').lean()))();
  let sent = 0;
  for (const user of users) {
    const trainerId = String(user.trainer || user.assistantTrainer || ''), pending = groups.get(trainerId);
    if (!pending?.length) continue;
    const target = pending[0], params = new URLSearchParams({ date: clock.dateKey, trainer: trainerId, schedule: String(target.scheduleId), subject: String(target.subjectId || '') });
    const labels = pending.map(slot => [slot.slot, slot.branchYearSection].filter(Boolean).join(' · ')).filter(Boolean).join('; ');
    const message = `Hi! You still have ${pending.length} unclosed topic tracker${pending.length === 1 ? '' : 's'} for today's classes (${clock.dateKey}). Please close ${pending.length === 1 ? 'it' : 'them'} when you can.${labels ? ` Classes: ${labels.slice(0, 300)}.` : ''}`;
    if (await (deps.create || createNotificationOnce)(`tracker-reminder:${clock.dateKey}:${user._id}`, {
      recipient: user._id, actor: actor._id, actorName: 'TOMS', actorRole: actor.role,
      action: 'reminded', resource: 'topic tracker reminder', message, entityPath: `/topic-tracker?${params}`,
    })) sent++;
  }
  return { sent, date: clock.dateKey };
};

// Existing Render keep-awake health pings keep the service running. On restart
// after 18:00 IST, retry today's reminders; deterministic IDs prevent duplicates.
export const startScheduledNotifications = () => {
  let running = false, reminderDate = '', announcementAt = 0;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date(), clock = getIstNowParts(now);
      if (now.getTime() - announcementAt > 3600000) {
        await publishFeedbackAnnouncement(); announcementAt = now.getTime();
      }
      if (clock.minutes >= 1080 && reminderDate !== clock.dateKey) {
        const result = await sendTopicTrackerReminders(now);
        if (!result.skipped) reminderDate = clock.dateKey;
      }
    } catch { console.warn('Scheduled TOMS notifications will retry on the next minute.'); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(tick, 60000); timer.unref();
  return () => clearInterval(timer);
};
