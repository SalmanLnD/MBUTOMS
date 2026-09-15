import test from 'node:test';
import assert from 'node:assert/strict';
import Schedule from '../../models/Schedule.js';
import Subject from '../../models/Subject.js';
import Trainer from '../../models/Trainer.js';
import Leave from '../../models/Leave.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';
import { clearSubjectStartDateCache } from '../../utils/subjectStartDate.js';
import { buildTrainerAvailabilityForRange } from '../../utils/trainerAvailability.js';

const slot = (startTime, endTime) => ({ startTime, endTime });
const fullDay = [slot('09:00', '17:00')];
const trainers = [
  { _id: 'main', employeeId: 'MAIN', name: 'Main Trainer' },
  { _id: 'cover', employeeId: 'COVER', name: 'Cover Trainer' },
];
const subject = {
  _id: 'subject', code: 'COURSE', name: 'Course',
  startDate: new Date('2026-09-14'), endDate: new Date('2026-09-21'),
};
const schedule = (overrides = {}) => ({
  _id: 'class', trainerCode: 'MAIN', subject: 'subject', subjectCode: 'COURSE',
  day: 'Monday', ...slot('10:00', '11:00'), ...overrides,
});

function fixtures(t, { schedules = [schedule()], leaves = [], cancellations = [], holidays = [] } = {}) {
  const query = (rows) => ({
    select() { return this; }, populate() { return this; }, sort() { return this; },
    lean: async () => rows,
  });
  t.mock.method(Subject, 'find', () => query([subject]));
  t.mock.method(Trainer, 'find', (filter) => query(
    trainers.filter((trainer) => !filter._id || filter._id.$in.includes(trainer._id))
  ));
  t.mock.method(Schedule, 'find', (filter) => query(schedules.filter((row) =>
    filter._id ? filter._id.$in.includes(row._id) : filter.trainerCode.$in.includes(row.trainerCode)
  )));
  t.mock.method(Leave, 'find', (filter) => query(leaves.filter((leave) =>
    leave.status === 'approved' && (filter.trainer
      ? filter.trainer.$in.includes(leave.trainer)
      : leave.replacements?.length)
  )));
  t.mock.method(ClassCancellation, 'find', () => query(cancellations));
  t.mock.method(OfficialHoliday, 'find', () => query(holidays));
  clearSubjectStartDateCache();
  t.after(clearSubjectStartDateCache);
}

const read = (date = '2026-09-14', options = {}) => buildTrainerAvailabilityForRange({
  startDate: date, endDate: date, ...options,
});
const dayFor = (data, id = 'main') => data.trainers.find((row) => row._id === id).availability[0];

test('availability consumes real subject range objects for IDs, codes and fallback dates', async (t) => {
  for (const linkage of [{ subject: 'subject' }, { subject: null, subjectCode: ' COURSE ' },
    { subject: { _id: 'subject' } }, { subject: null, subjectCode: '' }]) {
    await t.test(JSON.stringify(linkage), async (t) => {
      fixtures(t, { schedules: [schedule(linkage)] });
      assert.deepEqual(dayFor(await read()).slots, [slot('09:00', '10:00'), slot('11:00', '17:00')]);
    });
  }
});

test('subject start and end days are inclusive, independently of clock-time filters', async (t) => {
  fixtures(t);
  for (const [date, active] of [['2026-09-07', false], ['2026-09-14', true],
    ['2026-09-21', true], ['2026-09-28', false]]) {
    assert.deepEqual(dayFor(await read(date)).slots,
      active ? [slot('09:00', '10:00'), slot('11:00', '17:00')] : fullDay);
    assert.deepEqual(dayFor(await read(date, { slotStart: '10:30', slotEnd: '11:30' })).slots,
      active ? [slot('11:00', '11:30')] : [slot('10:30', '11:30')]);
  }
});

test('time clipping preserves busy periods, minimum duration and late-class rule', async (t) => {
  fixtures(t, { schedules: [schedule(), schedule({ _id: 'late', ...slot('15:00', '16:45') })] });
  for (const [start, end, expected] of [
    ['09:00', '17:00', [slot('09:00', '10:00'), slot('11:00', '15:00')]],
    ['09:30', '11:30', [slot('09:30', '10:00'), slot('11:00', '11:30')]],
    ['10:00', '11:00', []], ['11:00', '11:15', [slot('11:00', '11:15')]],
    ['11:00', '11:14', []], ['16:45', '17:00', []],
  ]) {
    assert.deepEqual(dayFor(await read(undefined, { slotStart: start, slotEnd: end })).slots, expected);
  }
});

test('approved leave blocks owner and replacement blocks cover only during subject dates', async (t) => {
  fixtures(t, { leaves: [{ trainer: 'main', status: 'approved',
    startDate: new Date('2026-09-14'), endDate: new Date('2026-09-28'),
    replacements: [{ schedule: 'class', replacementTrainer: 'cover' }],
  }] });
  const data = await read();
  assert.equal(dayFor(data).onLeave, true);
  assert.deepEqual(dayFor(data).slots, []);
  assert.deepEqual(dayFor(data, 'cover').slots, [slot('09:00', '10:00'), slot('11:00', '17:00')]);
  assert.deepEqual(dayFor(await read('2026-09-28'), 'cover').slots, fullDay);
  assert.deepEqual(dayFor(await read(undefined, { trainerIds: ['cover'] }), 'cover'), dayFor(data, 'cover'));
});

test('cancelled classes and holidays preserve free time', async (t) => {
  fixtures(t, { cancellations: [{ date: new Date('2026-09-14'), schedules: ['class'] }],
    holidays: [{ date: new Date('2026-09-21'), name: 'Holiday' }] });
  assert.deepEqual(dayFor(await read()).slots, fullDay);
  const holiday = dayFor(await read('2026-09-21'));
  assert.equal(holiday.isOfficialHoliday, true);
  assert.deepEqual(holiday.slots, fullDay);
});
