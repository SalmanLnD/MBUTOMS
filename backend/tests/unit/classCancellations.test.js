import test from 'node:test';
import assert from 'node:assert/strict';
import { excludeCanceledSchedules } from '../../utils/classCancellations.js';
import {
  buildAffectedClassOccurrences,
  buildCanceledScheduleIdsByDate,
  getUncancelledScheduleDateKeys,
} from '../../utils/leaveAffectedClasses.js';

test('excludes only schedules canceled for the selected date', () => {
  const schedules = [
    { _id: { toString: () => 'schedule-1' } },
    { _id: { toString: () => 'schedule-2' } },
    { _id: { toString: () => 'schedule-3' } },
  ];

  const result = excludeCanceledSchedules(
    schedules,
    new Set(['schedule-1', 'schedule-3'])
  );

  assert.deepEqual(
    result.map((schedule) => schedule._id.toString()),
    ['schedule-2']
  );
});

test('a fully canceled leave date has zero affected classes', () => {
  const schedules = ['schedule-1', 'schedule-2', 'schedule-3'].map((id) => ({
    _id: { toString: () => id },
    day: 'Friday',
  }));
  const cancellationMap = buildCanceledScheduleIdsByDate([{
    date: '2026-08-21',
    schedules,
  }]);

  const occurrences = buildAffectedClassOccurrences(
    { startDate: '2026-08-21', endDate: '2026-08-21' },
    schedules,
    cancellationMap
  );

  assert.equal(occurrences.length, 0);
});

test('official holidays exclude leave class occurrences without treating them as client cancellations', () => {
  const mondaySchedule = {
    _id: { toString: () => 'schedule-monday' },
    day: 'Monday',
  };
  const tuesdaySchedule = {
    _id: { toString: () => 'schedule-tuesday' },
    day: 'Tuesday',
  };
  const holidayDateKeys = new Set(['2026-09-14']);

  assert.deepEqual(
    getUncancelledScheduleDateKeys(
      { startDate: '2026-09-12', endDate: '2026-09-16' },
      mondaySchedule,
      new Map(),
      holidayDateKeys
    ),
    []
  );

  assert.deepEqual(
    getUncancelledScheduleDateKeys(
      { startDate: '2026-09-12', endDate: '2026-09-16' },
      tuesdaySchedule,
      new Map(),
      holidayDateKeys
    ),
    ['2026-09-15']
  );

  const occurrences = buildAffectedClassOccurrences(
    { startDate: '2026-09-12', endDate: '2026-09-16' },
    [mondaySchedule, tuesdaySchedule],
    new Map(),
    holidayDateKeys
  );
  assert.deepEqual(
    occurrences.map((row) => row.date),
    ['2026-09-15']
  );
});

test('a replacement remains required for uncanceled occurrences in a multi-week leave', () => {
  const schedule = {
    _id: { toString: () => 'schedule-1' },
    day: 'Friday',
  };
  const cancellationMap = buildCanceledScheduleIdsByDate([{
    date: '2026-08-21',
    schedules: [schedule],
  }]);

  assert.deepEqual(
    getUncancelledScheduleDateKeys(
      { startDate: '2026-08-21', endDate: '2026-08-28' },
      schedule,
      cancellationMap
    ),
    ['2026-08-28']
  );
});
