import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTimetableExportCell } from '../../utils/timetableExport.js';

test('timetable sheet cells include venue like the UI', () => {
  assert.equal(
    formatTimetableExportCell({
      subjectCode: '22CS102033',
      department: 'EEE',
      section: 'EEE1',
      startTime: '09:00',
      endTime: '10:50',
      venue: { name: '4420' },
    }),
    '22CS102033\nEEE EEE1\nVenue 4420\n09:00-10:50'
  );
});

test('timetable sheet cells omit venue when the slot has no room', () => {
  assert.equal(
    formatTimetableExportCell({
      subjectCode: '22CS102033',
      department: 'EEE',
      section: 'EEE2',
      startTime: '09:00',
      endTime: '10:50',
    }),
    '22CS102033\nEEE EEE2\n09:00-10:50'
  );
});
