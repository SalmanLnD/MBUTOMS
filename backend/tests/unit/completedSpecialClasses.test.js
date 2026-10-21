import { test } from 'node:test';
import assert from 'node:assert/strict';
import { specialClassCompletionTime } from '../../utils/specialClass.js';
import { getSpecialClasses } from '../../controllers/scheduleController.js';
import Schedule from '../../models/Schedule.js';
import Trainer from '../../models/Trainer.js';
import ClassGroup from '../../models/ClassGroup.js';

test('completion uses the last actual weekday and class end time in India', () => {
  const group = { specialType: 'recurring', startDate: '2026-10-01', endDate: '2026-10-25', days: ['Monday', 'Wednesday'], endTime: '16:00' };
  const completion = specialClassCompletionTime(group);
  assert.equal(completion.toISOString(), '2026-10-21T10:30:00.000Z');
  assert.ok(completion > new Date('2026-10-21T10:29:59Z'));
  assert.ok(completion <= new Date('2026-10-21T10:30:00Z'));
  assert.equal(specialClassCompletionTime({ ...group, specialType: 'one_time', startDate: '2026-10-21', endDate: '2026-10-21' }).toISOString(), completion.toISOString());
  assert.equal(specialClassCompletionTime({ ...group, endTime: '16:00:00' }).toISOString(), completion.toISOString());
});

test('completed list shows one-time classes and one row per finished recurring group', async t => {
  const base = { trainerCode: '100', department: 'CSE', section: 'A', semester: 'III', subjectCode: 'TEST', startTime: '09:00', endTime: '10:00' };
  const records = [
    { ...base, _id: 'one', specialGroupId: 'one', specialType: 'one_time', specialStartDate: '2020-10-01', specialEndDate: '2020-10-01', day: 'Thursday' },
    ...['Monday', 'Wednesday'].map((day, i) => ({ ...base, _id: `done-${i}`, specialGroupId: 'done', specialType: 'recurring', specialStartDate: '2020-10-01', specialEndDate: '2020-10-31', day })),
    ...['Tuesday', 'Thursday'].map((day, i) => ({ ...base, _id: `ongoing-${i}`, specialGroupId: 'ongoing', specialType: 'recurring', specialStartDate: '2020-10-01', specialEndDate: '2100-10-31', day })),
  ];
  const query = rows => ({ select() { return this; }, sort() { return this; }, lean: async () => rows });
  t.mock.method(Schedule, 'find', () => query(records));
  t.mock.method(Trainer, 'find', () => query([]));
  t.mock.method(ClassGroup, 'find', () => query([]));
  let response;
  await getSpecialClasses({ query: { status: 'completed' } }, { json: value => { response = value; } });
  assert.deepEqual(response.specialClasses.map(group => group.specialGroupId), ['done', 'one']);
  assert.equal(response.specialClasses[0].scheduleIds.length, 2);
  await getSpecialClasses({ query: { status: 'upcoming' } }, { json: value => { response = value; } });
  assert.deepEqual(response.specialClasses.map(group => group.specialGroupId), ['ongoing']);
});
