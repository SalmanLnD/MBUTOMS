import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotificationOnce, scheduledNotificationId, publishFeedbackAnnouncement,
  sendTopicTrackerReminders, groupPendingTrackerSessions,
} from '../../services/scheduledNotifications.js';
import { getCurrentAnnouncement, dismissAnnouncement } from '../../controllers/announcementController.js';
import AnnouncementReceipt from '../../models/AnnouncementReceipt.js';
import { FEEDBACK_ANNOUNCEMENT } from '../../utils/feedbackAnnouncement.js';

const actor = async () => ({ _id: 'admin', name: 'Salman', role: 'admin' });
const base = { scheduleId: 's1', trainerId: 't1', subjectId: 'subject', trackerStatus: 'pending', slot: 'S1', branchYearSection: 'CSE A' };
test('6 pm IST reminders include only pending teaching sessions and target campus replacements', async () => {
  const sent = new Map();
  const deps = { actor,
    sessions: async () => ({ sessions: [base, { ...base }, { ...base, scheduleId: 'closed', trackerStatus: 'closed' },
      { ...base, scheduleId: 'replacement', isReplacementAssignment: true, replacementTrainerId: 't2' },
      { ...base, scheduleId: 'external', isReplacementAssignment: true, replacementTrainerId: '' }] }),
    users: async () => [{ _id: 'u1', trainer: 't1' }, { _id: 'u2', trainer: 't2' }, { _id: 'admin', assistantTrainer: 't1', role: 'admin' }],
    create: async (key, value) => { if (sent.has(key)) return false; sent.set(key, value); return true; },
  };
  assert.equal((await sendTopicTrackerReminders(new Date('2026-10-06T12:29:59Z'), deps)).sent, 0);
  assert.equal(sent.size, 0);
  const result = await sendTopicTrackerReminders(new Date('2026-10-06T12:30:00Z'), deps);
  assert.equal(result.sent, 3);
  assert.match(sent.get('tracker-reminder:2026-10-06:u1').message, /1 unclosed topic tracker/);
  assert.ok(sent.get('tracker-reminder:2026-10-06:u2').entityPath.includes('schedule=replacement'));
  assert.equal((await sendTopicTrackerReminders(new Date('2026-10-06T13:00:00Z'), deps)).sent, 0);
  assert.equal((await sendTopicTrackerReminders(new Date('2026-10-07T12:30:00Z'), deps)).sent, 3);
});

test('holidays, cancelled/no classes and fully closed days send nothing', async () => {
  for (const sessions of [[], [{ ...base, trackerStatus: 'closed' }]]) {
    const result = await sendTopicTrackerReminders(new Date('2026-10-06T12:30:00Z'), {
      actor, sessions: async () => ({ sessions }), users: async () => { throw Error('No recipients should be queried'); },
    });
    assert.equal(result.sent, 0);
  }
  assert.equal(groupPendingTrackerSessions([{ ...base, isReplacementAssignment: true }]).size, 0);
});

test('stable notification IDs prevent duplicates across restarts and concurrent workers', async () => {
  const ids = new Set(), model = { create: async doc => {
    const key = String(doc._id);
    if (ids.has(key)) throw Object.assign(Error('Duplicate'), { code: 11000 });
    ids.add(key);
  } };
  const results = await Promise.all([createNotificationOnce('same', {}, model), createNotificationOnce('same', {}, model)]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(String(scheduledNotificationId('same')), String(scheduledNotificationId('same')));
  assert.notEqual(String(scheduledNotificationId('same')), String(scheduledNotificationId('other')));
  await assert.rejects(createNotificationOnce('failure', {}, { create: async () => { throw Error('Offline'); } }), /Offline/);
});

test('announcement delivery happens once for each account and links to the modal', async () => {
  const sent = new Map(), deps = { actor, users: async () => [{ _id: 'u1' }, { _id: 'u2' }],
    create: async (key, value) => { if (sent.has(key)) return false; sent.set(key, value); return true; } };
  assert.equal((await publishFeedbackAnnouncement(deps)).sent, 2);
  assert.equal((await publishFeedbackAnnouncement(deps)).sent, 0);
  assert.ok([...sent.values()].every(value => value.entityPath === `/dashboard?announcement=${FEEDBACK_ANNOUNCEMENT.id}`));
});

test('announcement dismissal persists per account and preview cannot dismiss a real user', async t => {
  const rows = new Map();
  t.mock.method(AnnouncementReceipt, 'findById', key => ({ lean: async () => rows.get(key) }));
  t.mock.method(AnnouncementReceipt, 'updateOne', async (filter, update) => rows.set(filter._id, update.$setOnInsert));
  const req = { user: { _id: 'u1' }, params: { id: FEEDBACK_ANNOUNCEMENT.id } };
  let data, status = 200;
  const res = { json: value => { data = value; }, status(code) { status = code; return this; } };
  await getCurrentAnnouncement(req, res); assert.equal(data.dismissed, false);
  await dismissAnnouncement(req, res);
  await getCurrentAnnouncement(req, res); assert.equal(data.dismissed, true);
  await getCurrentAnnouncement({ user: { _id: 'u2' } }, res); assert.equal(data.dismissed, false);
  await dismissAnnouncement({ ...req, impersonator: { _id: 'admin' } }, res); assert.equal(status, 403);
  await dismissAnnouncement({ ...req, params: { id: 'unknown' } }, res); assert.equal(status, 404);
  assert.equal(rows.size, 1);
});
