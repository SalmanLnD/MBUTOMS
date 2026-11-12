import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentSummaryRows, buildTestReportSheetsExportPayload } from '../../utils/studentTestReportExport.js';
import { getMonthLabelFromKey, getReportMonthKeys } from '../../utils/studentTestReportDates.js';
import StudentMonthlyTestReport from '../../models/StudentMonthlyTestReport.js';
import Student from '../../models/Student.js';
import Schedule from '../../models/Schedule.js';
const students = [{_id:'s', rollNumber:'001',name:'Student',branch:'CSE',sectionLabel:'A',semesterLabel:'III'}];
const subjects = [{department:'CSE',section:'A',semester:'III',subject:{_id:'x',name:'Test',code:'X'}}];
const report = (month, marksObtained, attendance='P') => ({student:'s',subject:'x',month,marksObtained,attendance});
test('student summary handles missing and ungraded marks, zero and absence', () => {
 const make = rows => buildStudentSummaryRows(students,subjects,rows)[1].slice(7);
 assert.deepEqual(make([]),['NA','NA','NA','Not finalized']);
 assert.deepEqual(make([report('2026-08',0),report('2026-09',6),report('2026-10',9)]),[0,6,9,5]);
 assert.deepEqual(make([report('2026-08',null),report('2026-09',6),report('2026-10',9)]),['NA',6,9,'Not finalized']);
 assert.deepEqual(make([report('2026-08',1),report('2026-09',null,'A'),report('2026-10',9)]),[1,'Absent',9,'Not finalized']);
});
test('deduplicates timetable slots and keeps subjects distinct', () => {
 const rows=buildStudentSummaryRows(students,[...subjects,...subjects,{...subjects[0],subject:{_id:'y',name:'Other',code:'Y'}}],[]);
 assert.equal(rows.length,3);
 assert.deepEqual(rows.slice(1).map(r=>r[6]),['X','Y']);
});

test('department transfers retain old-subject marks in student summary', () => {
 const moved=[{...students[0],branch:'ECE',sectionLabel:'B'}];
 const reports=[{...report('2026-08',0),subject:{_id:'x',name:'Original Subject',code:'X'},subjectName:'Original Subject',subjectCode:'X'}];
 const rows=buildStudentSummaryRows(moved,[],reports);
 assert.equal(rows.length,2);
 assert.equal(rows[1][2],'ECE');
 assert.equal(rows[1][6],'X');
 assert.equal(rows[1][7],0);
});

test('summary supports term-specific month columns', () => {
 const rows=buildStudentSummaryRows(students,subjects,[report('2027-01',8)],['2027-01','2027-02']);
 assert.deepEqual(rows[0].slice(7),['January 2027','February 2027','Average']);
 assert.deepEqual(rows[1].slice(7),[8,'NA','Not finalized']);
});

test('report export skips months without marks or recorded absences', async (t) => {
 const [markedMonth, placeholderMonth, absentMonth] = getReportMonthKeys();
 const query = (rows) => ({
  populate() { return this; },
  select() { return this; },
  sort() { return this; },
  async lean() { return rows; },
 });
 t.mock.method(StudentMonthlyTestReport, 'find', () => query([
  report(markedMonth, 0), report(placeholderMonth, null), report(absentMonth, null, 'A'),
 ]));
 t.mock.method(Student, 'find', () => query(students));
 t.mock.method(Schedule, 'find', () => query(subjects));

 const result = await buildTestReportSheetsExportPayload();
 assert.deepEqual(result.monthSheets.map(({ month }) => month), [markedMonth, absentMonth]);
 assert.deepEqual(result.studentSummaryRows[0].slice(7), [
  getMonthLabelFromKey(markedMonth), getMonthLabelFromKey(absentMonth), 'Average',
 ]);
 assert.deepEqual(result.studentSummaryRows[1].slice(7), [0, 'Absent', 'Not finalized']);
});
