import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRtetRangeStart,
  isRtetScheduleActiveOnDate,
  RTET_SUBJECTS,
} from '../../utils/rtetExport.js';

test('RTET reads startDate from cached subject range objects', () => {
  const code = RTET_SUBJECTS[0].code;
  const subjectRanges = {
    byId: new Map(),
    byCode: new Map(RTET_SUBJECTS.map((subject) => [subject.code, {
      startDate: new Date(Date.UTC(2026, 6, 20)),
      endDate: new Date(Date.UTC(2027, 4, 31)),
    }])),
  };

  assert.equal(
    isRtetScheduleActiveOnDate(
      { subjectCode: code },
      new Date(Date.UTC(2026, 6, 19)),
      subjectRanges
    ),
    false
  );
  assert.equal(
    isRtetScheduleActiveOnDate(
      { subjectCode: code },
      new Date(Date.UTC(2026, 6, 20)),
      subjectRanges
    ),
    true
  );
  assert.equal(getRtetRangeStart().toISOString().slice(0, 10), '2026-07-12');
});
