import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTopicModulesCovered,
  getEntryTopicModules,
  normalizeTopicModulesCovered,
} from '../../utils/topicTrackerEntryTopics.js';
import { resolveSubjectEndDate } from '../../utils/subjectStartDate.js';
import {
  calculateRemainingHoursForScheduleSet,
  buildClassSummaryKey,
  pickPrimaryTrainerForClassSummary,
  resolveClassSummaryTrainer,
} from '../../utils/topicTrackerSessions.js';
import { toAttendanceDateKey } from '../../utils/attendanceTracking.js';

test('normalizes multiple topics and removes blanks and duplicates', () => {
  assert.deepEqual(
    normalizeTopicModulesCovered(['Topic A', ' Topic B ', '', 'Topic A']),
    ['Topic A', 'Topic B']
  );
});

test('keeps a legacy topic containing commas as one topic', () => {
  const legacyTopic = 'Arrays: insertion, deletion, and traversal';
  assert.deepEqual(normalizeTopicModulesCovered(undefined, legacyTopic), [legacyTopic]);
  assert.deepEqual(getEntryTopicModules({ topicModuleCovered: legacyTopic }), [legacyTopic]);
});

test('formats multiple topics in one comma-separated sheet cell', () => {
  assert.equal(
    formatTopicModulesCovered(['Topic A', 'Topic B', 'Topic C']),
    'Topic A, Topic B, Topic C'
  );
});

test('topic tracker day window includes both UTC and IST midnight storage', async () => {
  const { getLeaveDayWindow, toLeaveDateKey } = await import('../../utils/leaveDateRange.js');
  const window = getLeaveDayWindow('2026-07-14');
  const utcMidnight = new Date('2026-07-14T00:00:00.000Z');
  const istMidnight = new Date('2026-07-14T00:00:00+05:30');

  assert.equal(toLeaveDateKey('2026-07-14'), '2026-07-14');
  assert.ok(utcMidnight >= window.start && utcMidnight < window.endExclusive);
  assert.ok(istMidnight >= window.start && istMidnight < window.endExclusive);
});

test('subject end-date defaults follow the configured academic window', () => {
  const solasEnd = resolveSubjectEndDate({ code: '22CA102006' });
  const schoolEnd = resolveSubjectEndDate({ code: '22CS102033' });

  assert.ok(solasEnd instanceof Date);
  assert.equal(solasEnd.toISOString().slice(0, 10), '2026-11-10');
  assert.equal(schoolEnd.toISOString().slice(0, 10), '2026-11-06');
});

test('remaining-hour calculation counts only the future timetable slots in range', () => {
  const cancellationMap = new Map();
  cancellationMap.set('2026-10-05', new Set(['s3']));

  const remaining = calculateRemainingHoursForScheduleSet({
    schedules: [
      { _id: 's1', day: 'Monday', startTime: '09:00', endTime: '11:00' },
      { _id: 's2', day: 'Monday', startTime: '11:30', endTime: '13:30' },
      { _id: 's3', day: 'Tuesday', startTime: '09:00', endTime: '11:00' },
    ],
    fromDate: '2026-10-05',
    toDate: '2026-10-07',
    cancellationMap,
    holidayDateKeys: new Set(['2026-10-06']),
  });

  assert.equal(remaining, 4);
});

test('class summary groups backup-trainer rows into one class row', () => {
  assert.equal(buildClassSummaryKey('AI&DS, PY 2029 Sem III - 1'), 'AI&DS, PY 2029 Sem III - 1');
  assert.equal(buildClassSummaryKey('CSE, Sem III - A6-Devops'), 'CSE, Sem III - A6');
  assert.equal(buildClassSummaryKey("CSE, Sem III - A7'-CC"), 'CSE, Sem III - A7');
  assert.deepEqual(
    pickPrimaryTrainerForClassSummary(
      [
        { trainerId: 't1', trainerName: 'Primary Trainer' },
        { trainerId: 't2', trainerName: 'Backup Trainer' },
      ]
    ),
    { trainerId: 't1', trainerName: 'Primary Trainer' }
  );
});

test('class summary resolves the scheduled main trainer instead of replacement coverage', () => {
  const trainerLookup = {
    byCode: new Map([['T1', { _id: 'trainer-1', name: 'Divya' }]]),
  };

  assert.deepEqual(
    resolveClassSummaryTrainer(
      { trainer: 'replacement-2', trainerName: 'Karra Roja', schedule: 'schedule-7' },
      new Map([['schedule-7', { trainerCode: 'T1' }]]),
      trainerLookup
    ),
    { trainerId: 'trainer-1', trainerName: 'Divya' }
  );
});

test('date helpers safely ignore missing or invalid values instead of throwing', () => {
  assert.equal(toAttendanceDateKey(''), '');
  assert.equal(toAttendanceDateKey(undefined), '');
  assert.equal(toAttendanceDateKey(null), '');
  assert.equal(toAttendanceDateKey('2026-09-10'), '2026-09-10');
});
