import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTimetableExecution } from '../../utils/timetableExecutionHours.js';

const subjectMap = {
  byId: new Map([
    ['math', {
      startDate: new Date(Date.UTC(2026, 6, 13)),
      endDate: new Date(Date.UTC(2026, 10, 10)),
    }],
  ]),
  byCode: new Map(),
};

const mondaySlot = {
  _id: 'slot-1',
  day: 'Monday',
  startTime: '09:00',
  endTime: '11:00',
  department: 'CSE',
  section: 'A',
  subject: { _id: 'math', name: 'Mathematics', code: 'MATH' },
};

test('scheduled hours keep cancellations and drop holidays', () => {
  const report = summarizeTimetableExecution({
    schedules: [mondaySlot],
    holidayDates: new Set(['2026-07-20']),
    canceledByDate: new Map([
      ['2026-07-20', new Set(['slot-1'])],
      ['2026-07-27', new Set(['slot-1'])],
    ]),
    subjectMap,
    completedByDate: new Map([['2026-07-13', new Set(['slot-1'])]]),
    now: new Date('2026-07-28T00:00:00Z'),
    fromKey: '2026-07-13',
    toKey: '2026-07-27',
  });

  assert.equal(report.totals.scheduledHours, 4);
  assert.equal(report.totals.cancelledHours, 2);
  assert.equal(report.totals.executedHours, 2);
  assert.equal(report.totals.executionPercent, 50);
  assert.equal(report.subjects[0].subjectName, 'Mathematics');
  assert.equal(report.subjects[0].executedHours, 2);
  assert.equal(report.classes[0].classLabel, 'CSE A');
  assert.equal(report.classes[0].scheduledHours, 4);
});

test('execution requires a completed tracker and a finished slot, with cancellation taking precedence', () => {
  const slots = [mondaySlot, { ...mondaySlot, _id: 'pending', startTime: '11:30', endTime: '13:30' },
    { ...mondaySlot, _id: 'future', startTime: '14:00', endTime: '16:00' },
    { ...mondaySlot, _id: 'cancelled', startTime: '16:00', endTime: '17:00' }];
  const report = summarizeTimetableExecution({ schedules: slots, subjectMap,
    fromKey: '2026-07-13', toKey: '2026-07-13', now: new Date('2026-07-13T08:30:00Z'),
    completedByDate: new Map([['2026-07-13', new Set(['slot-1', 'future', 'cancelled'])]]),
    canceledByDate: new Map([['2026-07-13', new Set(['cancelled'])]]) });
  assert.equal(report.totals.scheduledHours, 7);
  assert.equal(report.totals.cancelledHours, 1);
  assert.equal(report.totals.executedHours, 2);
  assert.equal(report.totals.pendingHours, 4);
  assert.equal(report.totals.executionPercent, 28.6);
});

test('the scheduled end time in India governs completion, even on a UTC date boundary', () => {
  const slot = { ...mondaySlot, startTime: '00:15', endTime: '01:15' };
  const args = { schedules: [slot], subjectMap, fromKey: '2026-07-13', toKey: '2026-07-13',
    completedByDate: new Map([['2026-07-13', new Set(['slot-1'])]]) };
  assert.equal(summarizeTimetableExecution({ ...args, now: new Date('2026-07-12T19:44:59Z') }).totals.executedHours, 0);
  assert.equal(summarizeTimetableExecution({ ...args, now: new Date('2026-07-12T19:45:00Z') }).totals.executedHours, 1);
});

test('past slots without completed tracker records remain awaiting completion', () => {
  const report = summarizeTimetableExecution({ schedules: [mondaySlot], subjectMap,
    fromKey: '2026-07-13', toKey: '2026-07-13', now: new Date('2026-07-14T00:00:00Z') });
  assert.equal(report.totals.executedHours, 0);
  assert.equal(report.totals.pendingHours, 2);
});

test('empty schedules and invalid time ranges contribute no hours', () => {
  const report = summarizeTimetableExecution({ schedules: [{ ...mondaySlot, startTime: '17:00', endTime: '16:00' }],
    subjectMap, fromKey: '2026-07-13', toKey: '2026-07-13' });
  assert.equal(report.totals.scheduledHours, 0);
  assert.equal(report.totals.executionPercent, 0);
  assert.deepEqual(report.subjects, []);
});

test('different subjects and classes have independent totals', () => {
  const second = { ...mondaySlot, _id: 'second', department: 'ECE', section: 'B', subject: null, subjectCode: 'OTHER' };
  const report = summarizeTimetableExecution({ schedules: [mondaySlot, second], subjectMap,
    fromKey: '2026-07-13', toKey: '2026-07-13', now: new Date('2026-07-14T00:00:00Z'),
    completedByDate: new Map([['2026-07-13', new Set(['slot-1'])]]) });
  assert.equal(report.subjects.length, 2);
  assert.equal(report.classes.length, 2);
  assert.equal(report.classes.find(row => row.classLabel === 'CSE A').executedHours, 2);
  assert.equal(report.classes.find(row => row.classLabel === 'ECE B').pendingHours, 2);
});

test('future and malformed end times cannot be reported as executed', () => {
  const future = { ...mondaySlot, _id: 'future', endTime: '25:00' };
  const report = summarizeTimetableExecution({ schedules: [future], subjectMap,
    fromKey: '2026-07-13', toKey: '2026-07-13', now: new Date('2026-07-15T00:00:00Z'),
    completedByDate: new Map([['2026-07-13', new Set(['future'])]]) });
  assert.equal(report.totals.executedHours, 0);
});
