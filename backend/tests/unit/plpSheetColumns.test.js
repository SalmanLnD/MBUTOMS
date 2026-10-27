import test from 'node:test';
import assert from 'node:assert/strict';
import { compactPlpSheetRows } from '../../utils/plpSheetColumns.js';

test('compact sheet keeps configured weight labels, calculated values, manual final and RRD dates', () => {
  const header = ['Employee ID', 'Trainer', 'Feedback (15%)', 'Responses', 'Class (10%)',
    'Demo (15%)', 'Attendance (50%)', 'RRD', 'Compliance (10%)'];
  const result = compactPlpSheetRows([{ employeeId: '123', name: 'Trainer', feedbackRating: 3.75,
    classObservationRating: 4, demoObservationRating: 4, attendanceScore: 3, complianceScore: 4,
    calculatedRaw: 3.4625, calculatedFinal: 3.5, manualFinal: 0, finalPlpRating: 0,
    replacementRequiredDates: ['2026-10-22', '2026-11-05'] }], header);
  assert.equal(result[0].length, 10);
  assert.deepEqual(result[0].slice(0, 7), [header[0], header[1], header[2], header[4], header[5], header[6], header[8]]);
  assert.deepEqual(result[1], ['123', 'Trainer', 3.75, 4, 4, 3, 4, 3.4625, 0, '22-10-2026, 05-11-2026']);
  assert.deepEqual(compactPlpSheetRows([{}], header)[1], ['', '', '', '', '', '', '', '', '', '']);
});
