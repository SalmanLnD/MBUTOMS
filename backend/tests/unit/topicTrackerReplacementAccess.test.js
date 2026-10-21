import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTopicTrackerSessions } from '../../utils/topicTrackerSessions.js';
import Schedule from '../../models/Schedule.js';
import Subject from '../../models/Subject.js';
import Trainer from '../../models/Trainer.js';
import Leave from '../../models/Leave.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';
import TopicTrackerEntry from '../../models/TopicTrackerEntry.js';
import { clearSubjectStartDateCache } from '../../utils/subjectStartDate.js';

test('replacement can open the original trainer overview row without accessing unrelated slots', async (t) => {
  const query = (rows) => ({
    select() { return this; },
    populate() { return this; },
    lean: async () => rows,
  });
  const subject = { _id: 'lrre', code: 'LRRE', name: 'Logical Reasoning',
    startDate: new Date('2026-07-13'), endDate: new Date('2026-11-06') };
  const original = { _id: 'sai', employeeId: 'SAI', name: 'Sai Kamesh' };
  const replacement = { _id: 'navya', employeeId: 'NAVYA', name: 'Navya Mallidi' };
  const slot = { trainerCode: 'SAI', day: 'Wednesday', subject,
    startTime: '09:00', endTime: '10:00', department: 'CSE', section: 'A', semester: 'III' };
  t.mock.method(Schedule, 'find', () => query([
    { ...slot, _id: 'covered' }, { ...slot, _id: 'uncovered' },
  ]));
  t.mock.method(Subject, 'find', () => query([subject]));
  t.mock.method(Trainer, 'find', () => query([original, replacement]));
  t.mock.method(Leave, 'find', () => query([{
    replacements: [{ schedule: 'covered', replacementTrainer: 'navya' }],
  }]));
  t.mock.method(ClassCancellation, 'find', () => query([]));
  t.mock.method(OfficialHoliday, 'find', () => query([]));
  t.mock.method(TopicTrackerEntry, 'find', () => query([]));
  clearSubjectStartDateCache();
  t.after(clearSubjectStartDateCache);

  for (const role of ['trainer', 'subject_coordinator']) {
    for (const trainerId of ['sai', 'navya']) {
      const result = await buildTopicTrackerSessions({
        date: '2026-10-21', subjectId: 'lrre', trainerId, lite: true,
        user: { role, trainer: 'navya', coordinatorSubjects: [] },
      });
      assert.deepEqual(result.sessions.map((row) => row.scheduleId), ['covered']);
      assert.equal(result.sessions[0].trainerName, 'Navya Mallidi');
    }
  }
  const unrelated = await buildTopicTrackerSessions({
    date: '2026-10-21', trainerId: 'sai', lite: true,
    user: { role: 'trainer', trainer: 'someone-else' },
  });
  assert.deepEqual(unrelated.sessions, []);
});
