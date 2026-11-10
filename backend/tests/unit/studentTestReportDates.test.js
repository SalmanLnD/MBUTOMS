import test from 'node:test';
import assert from 'node:assert/strict';
import { getReportMonthKeys, isValidReportMonth } from '../../utils/studentTestReportDates.js';
import { runWithAcademicTerm } from '../../utils/academicTermContext.js';

test('report months use selected term dates and stop at term end', () => {
  runWithAcademicTerm({ term: { startDate: new Date('2027-01-01'), endDate: new Date('2027-05-31') } }, () => {
    assert.deepEqual(getReportMonthKeys(new Date('2027-09-01')), ['2027-01','2027-02','2027-03','2027-04','2027-05']);
    assert.deepEqual(getReportMonthKeys(new Date('2027-02-10')), ['2027-01','2027-02']);
    assert.equal(isValidReportMonth('2026-09', new Date('2027-09-01')), false);
    assert.equal(isValidReportMonth('2027-05', new Date('2027-09-01')), true);
  });
});

test('future draft has no report months before its start', () => {
  runWithAcademicTerm({ term: { startDate: '2027-01-01', endDate: '2027-05-31' } }, () => {
    assert.deepEqual(getReportMonthKeys(new Date('2026-11-10')), []);
  });
});
