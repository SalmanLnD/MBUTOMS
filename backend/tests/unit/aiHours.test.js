import { test } from 'node:test';
import assert from 'node:assert/strict';
import Trainer from '../../models/Trainer.js';
import Schedule from '../../models/Schedule.js';
import Subject from '../../models/Subject.js';
import Leave from '../../models/Leave.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';
import ClassGroup from '../../models/ClassGroup.js';
import Student from '../../models/Student.js';
import { clearSubjectStartDateCache } from '../../utils/subjectStartDate.js';
import { computeClassHandlingHoursBatch } from '../../utils/trainerClassHoursBatch.js';
import { executeAiTool, readController } from '../../ai/aiTools.js';
import { getClassById, invalidateStudentCountCache } from '../../controllers/classController.js';

const query = (records) => ({
  select(fields) {
    const keys = fields.split(/\s+/);
    return query(records.map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key === '_id' || keys.includes(key)))));
  },
  sort() { return this; }, limit() { return this; }, populate() { return this; },
  lean: async () => records,
  then(resolve, reject) { return Promise.resolve(records).then(resolve, reject); },
});

test('AI explanation uses the unchanged official calculation for special, cancelled and replacement classes', async (t) => {
  const date = new Date('2026-10-01T00:00:00Z');
  const trainers = [{ _id: 'owner', employeeId: '100', name: 'Original', joiningDate: '2026-07-01' },
    { _id: 'cover', employeeId: '200', name: 'Replacement', joiningDate: '2026-07-01' }];
  const slot = (key, start, end, extra = {}) => ({ _id: key, day: 'Thursday', trainerCode: '100', startTime: start, endTime: end, subject: 'subject', subjectCode: 'TEST', semester: 'III', department: 'CSE', section: 'A1', ...extra });
  const records = [slot('regular', '09:00', '10:00'), slot('cancelled', '10:00', '12:00'),
    slot('covered', '12:00', '13:00'), slot('external-covered', '13:00', '14:00'),
    slot('special', '14:00', '16:00', { isSpecial: true, specialType: 'one_time', specialStartDate: date, specialEndDate: date, includeInRtet: false }),
    slot('expired', '16:00', '17:00', { subject: 'expired', subjectCode: 'OLD' })];
  const leave = { _id: 'leave', trainer: 'owner', status: 'approved', startDate: date, endDate: date,
    replacements: [{ schedule: 'covered', replacementTrainer: 'cover' }, { schedule: 'external-covered', isExternal: true, externalTrainerName: 'External' }] };
  t.mock.method(Schedule, 'find', (filter) => query(filter._id
    ? records.filter((s) => filter._id.$in.includes(s._id))
    : records.filter((s) => filter.trainerCode.$in.includes(s.trainerCode))));
  t.mock.method(Leave, 'find', () => query([leave]));
  t.mock.method(Subject, 'find', () => query([{ _id: 'subject', code: 'TEST', startDate: '2026-07-01', endDate: '2026-11-10' },
    { _id: 'expired', code: 'OLD', startDate: '2026-07-01', endDate: '2026-09-30' }]));
  t.mock.method(ClassCancellation, 'find', () => query([{ date, schedules: ['cancelled'] }]));
  t.mock.method(OfficialHoliday, 'find', () => query([]));
  clearSubjectStartDateCache(); t.after(clearSubjectStartDateCache);
  const normal = await computeClassHandlingHoursBatch(['owner', 'cover'], [date], 'III', trainers);
  const detailed = await computeClassHandlingHoursBatch(['owner', 'cover'], [date], 'III', trainers, { includeDetails: true });
  assert.equal(normal.get('owner|2026-10-01'), 3);
  assert.equal(normal.get('cover|2026-10-01'), 1);
  assert.equal(detailed.get('owner|2026-10-01').totalHours, normal.get('owner|2026-10-01'));
  assert.equal(detailed.get('cover|2026-10-01').totalHours, normal.get('cover|2026-10-01'));
  assert.deepEqual(detailed.get('owner|2026-10-01').schedules.map((s) => s._id), ['regular', 'special']);
  assert.equal(detailed.get('owner|2026-10-01').schedules[1].includeInRtet, false);
  const excluded = new Map(detailed.get('owner|2026-10-01').excludedSchedules.map((s) => [s._id, s]));
  assert.equal(excluded.get('cancelled').exclusion, 'cancelled_class');
  assert.equal(excluded.get('covered').exclusion, 'replacement_covered_class');
  assert.equal(excluded.get('external-covered').replacement.isExternal, true);
  assert.equal(excluded.get('expired').exclusion, 'outside_subject_or_special_dates');
  assert.equal(detailed.get('cover|2026-10-01').schedules[0].replacementForTrainerId, 'owner');
  const result = await executeAiTool('get_my_timetable', { date: '2026-10-01' }, { user: { role: 'trainer', trainer: 'owner' } }, {
    findTrainers: async () => [trainers[0]],
    subjectNames: new Map([['subject', 'Subject']]), venueNames: new Map(), trainerNames: new Map([['cover', { name: 'Replacement', employeeId: '200' }]]),
  });
  assert.equal(result.totalHours, 3);
  assert.equal(result.schedules.find((s) => s.isSpecial).includeInRtet, false);
  assert.equal(result.excludedSchedules.find((s) => s.kind === 'cancelled_class').startTime, '10:00');
  assert.equal(result.excludedSchedules.find((s) => s.replacement?.employeeId === '200').replacement.name, 'Replacement');
});

test('explanation fields preserve attendance slot deduplication and zero-hour holiday/joining behavior', async (t) => {
  const date = new Date('2026-10-01T00:00:00Z');
  const trainer = { _id: 'own', employeeId: '100', joiningDate: '2026-07-01' };
  const records = [{ _id: 'a', trainerCode: '100', day: 'Thursday', startTime: '09:00', endTime: '10:00', subjectCode: 'TEST', semester: 'III', department: 'CSE', section: 'A1' },
    { _id: 'b', trainerCode: '100', day: 'Thursday', startTime: '09:00', endTime: '10:00', subjectCode: 'TEST', semester: 'III', department: 'CSE', section: 'A2' }];
  t.mock.method(Schedule, 'find', () => query(records));
  t.mock.method(Subject, 'find', () => query([]));
  t.mock.method(Leave, 'find', () => query([]));
  t.mock.method(ClassCancellation, 'find', () => query([]));
  const holidays = t.mock.method(OfficialHoliday, 'find', () => query([]));
  clearSubjectStartDateCache(); t.after(clearSubjectStartDateCache);
  const compute = (details, record = trainer) => computeClassHandlingHoursBatch(['own'], [date], 'III', [record], { includeDetails: details });
  assert.equal((await compute(false)).get('own|2026-10-01'), 1);
  assert.equal((await compute(true)).get('own|2026-10-01').totalHours, 1);
  const beforeJoining = (await compute(true, { ...trainer, joiningDate: '2026-10-02' })).get('own|2026-10-01');
  assert.equal(beforeJoining.totalHours, 0);
  assert.equal(beforeJoining.excludedSchedules[0].exclusion, 'before_joining_date');
  holidays.mock.mockImplementation(() => query([{ date, name: 'Test holiday' }]));
  const holiday = (await compute(true)).get('own|2026-10-01');
  assert.equal(holiday.totalHours, 0);
  assert.equal(holiday.excludedSchedules[0].exclusion, 'official_holiday');
});

test('real class controllers enforce trainer access before exposing counts', async (t) => {
  const own = { _id: 'own-class', department: 'CSE', section: 'A1', currentSemester: 'III', status: 'active' };
  const other = { _id: 'other-class', department: 'CSE', section: 'A2', currentSemester: 'III', status: 'active' };
  t.mock.method(ClassGroup, 'find', () => query([own, other]));
  t.mock.method(ClassGroup, 'findById', () => ({ lean: async () => other }));
  t.mock.method(Trainer, 'findById', () => ({ select: () => ({ lean: async () => ({ employeeId: '100' }) }) }));
  t.mock.method(Schedule, 'find', () => query([{ department: 'CSE', section: 'A1', semester: 'III' }]));
  t.mock.method(Student, 'aggregate', async () => [{ _id: { department: 'CSE', section: 'A1', semester: 'III' }, studentCount: 40 }]);
  invalidateStudentCountCache(); t.after(invalidateStudentCountCache);
  const req = { user: { role: 'trainer', trainer: 'own' } };
  let status = 200;
  await getClassById({ ...req, params: { id: 'other-class' } }, { status(code) { status = code; return this; }, json() {} });
  assert.equal(status, 403);
  const denied = await executeAiTool('get_class_student_count', { department: 'CSE', section: 'A2', semester: 'III' }, req);
  assert.equal(denied.error, 'not_found');
  const permitted = await executeAiTool('get_class_student_count', { department: 'CSE', section: 'A1', semester: 'III' }, req);
  assert.equal(permitted.activeStudentCount, 40);
});
