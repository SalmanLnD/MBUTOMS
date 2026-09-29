import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSpecialScheduleActiveOnDate,
  isSpecialScheduleInRange,
  getWeekRangeForDate,
  getWeekdayForDateKey,
  getWeekdaysBetween,
} from '../../utils/specialClass.js';
import { getScheduleSubjectRange } from '../../utils/subjectStartDate.js';

const utc = (key) => new Date(`${key}T00:00:00.000Z`);

const oneTime = {
  isSpecial: true,
  specialType: 'one_time',
  specialStartDate: utc('2026-10-03'),
  specialEndDate: utc('2026-10-03'),
};

const recurring = {
  isSpecial: true,
  specialType: 'recurring',
  specialStartDate: utc('2026-10-01'),
  specialEndDate: utc('2026-10-31'),
};

test('regular schedules are active on every date', () => {
  assert.equal(isSpecialScheduleActiveOnDate({ day: 'Monday' }, utc('2020-01-06')), true);
  assert.equal(isSpecialScheduleInRange({ day: 'Monday' }, utc('2020-01-01'), utc('2020-01-31')), true);
});

test('one-time special class is active only on its date', () => {
  assert.equal(isSpecialScheduleActiveOnDate(oneTime, utc('2026-10-03')), true);
  assert.equal(isSpecialScheduleActiveOnDate(oneTime, utc('2026-10-10')), false);
  assert.equal(isSpecialScheduleActiveOnDate(oneTime, utc('2026-09-26')), false);
});

test('recurring special class is active inside its date range only', () => {
  assert.equal(isSpecialScheduleActiveOnDate(recurring, utc('2026-10-01')), true);
  assert.equal(isSpecialScheduleActiveOnDate(recurring, utc('2026-10-31')), true);
  assert.equal(isSpecialScheduleActiveOnDate(recurring, utc('2026-11-01')), false);
  assert.equal(isSpecialScheduleActiveOnDate(recurring, utc('2026-09-30')), false);
});

test('range overlap check for special classes', () => {
  assert.equal(isSpecialScheduleInRange(oneTime, utc('2026-09-28'), utc('2026-10-04')), true);
  assert.equal(isSpecialScheduleInRange(oneTime, utc('2026-10-05'), utc('2026-10-11')), false);
  assert.equal(isSpecialScheduleInRange(recurring, utc('2026-10-30'), utc('2026-11-05')), true);
});

test('week range is Monday to Sunday', () => {
  const { start, end } = getWeekRangeForDate(utc('2026-10-03'));
  assert.equal(start.toISOString().slice(0, 10), '2026-09-28');
  assert.equal(end.toISOString().slice(0, 10), '2026-10-04');
});

test('weekday helpers', () => {
  assert.equal(getWeekdayForDateKey('2026-10-03'), 'Saturday');
  assert.deepEqual(getWeekdaysBetween(utc('2026-10-01'), utc('2026-10-02')), ['Thursday', 'Friday']);
  assert.equal(getWeekdaysBetween(utc('2026-10-01'), utc('2026-10-31')).length, 7);
});

test('subject range for a special schedule uses its own dates', () => {
  const range = getScheduleSubjectRange(recurring);
  assert.equal(range.startDate.getTime(), recurring.specialStartDate.getTime());
  assert.equal(range.endDate.getTime(), recurring.specialEndDate.getTime());
});
