import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAssignmentDateLabel,
  buildAssignmentDetail,
  buildReplacementCancellationMessages,
  buildReplacementNotificationMessages,
} from '../../utils/replacementNotifications.js';

const detail = '03 Aug 2026 — ECE3, 09:00–10:50';

test('initial replacement messages notify the new and original trainers', () => {
  const messages = buildReplacementNotificationMessages({
    originalTrainerName: 'Barath',
    replacementTrainerName: 'Surya',
    detail,
  });

  assert.match(messages.replacement, /assigned to cover Barath's class/);
  assert.match(messages.original, /Surya was assigned/);
  assert.equal(messages.previous, '');
});

test('changed replacement messages name old and new trainers for everyone involved', () => {
  const messages = buildReplacementNotificationMessages({
    originalTrainerName: 'Barath',
    replacementTrainerName: 'Surya',
    previousReplacementTrainerName: 'Rounak',
    detail,
  });

  assert.match(messages.replacement, /replacing Rounak/);
  assert.match(messages.original, /changed from Rounak to Surya/);
  assert.match(messages.previous, /no longer assigned/);
  assert.match(messages.previous, /Surya is the new replacement/);
});

test('leave cancellation messages notify replacement trainers and original trainer', () => {
  const detailLines = [
    '03 Aug 2026 — ECE3, 09:00–10:50',
    '03 Aug 2026 — CE-ME 1, 11:10–13:00',
  ];
  const messages = buildReplacementCancellationMessages({
    originalTrainerName: 'Barath',
    detailLines,
  });

  assert.match(messages.replacement, /leave was cancelled/);
  assert.match(messages.replacement, /assignments were revoked/);
  assert.match(messages.replacement, /ECE3/);
  assert.match(messages.original, /Your leave was cancelled/);
  assert.match(messages.original, /assignments were revoked/);
});

test('replacement assignment detail uses the slot weekday date, not the full leave span', () => {
  const leave = {
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-03T00:00:00.000Z'),
  };
  const schedule = {
    day: 'Monday',
    department: 'ECE & EIE',
    section: 'ECE3',
    startTime: '09:00',
    endTime: '10:50',
  };

  assert.equal(buildAssignmentDateLabel(leave, schedule), '03 Aug 2026 (Monday)');
  assert.equal(
    buildAssignmentDetail(leave, schedule),
    '03 Aug 2026 (Monday) — ECE & EIE ECE3, 09:00–10:50'
  );
  assert.doesNotMatch(buildAssignmentDetail(leave, schedule), /01 Aug 2026 to 03 Aug 2026/);
});
