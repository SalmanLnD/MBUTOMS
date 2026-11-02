import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentSummaryRows } from '../../utils/studentTestReportExport.js';
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
