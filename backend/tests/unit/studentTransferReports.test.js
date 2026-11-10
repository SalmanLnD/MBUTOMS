import test from 'node:test';
import assert from 'node:assert/strict';
import Student from '../../models/Student.js';
import Subject from '../../models/Subject.js';
import StudentMonthlyTestReport from '../../models/StudentMonthlyTestReport.js';
import { getTestReportGrid, bulkUpsertTestReports, getStudentTestHistory } from '../../controllers/studentTestReportController.js';

const query = (value) => {
  const chain = { select: () => chain, sort: () => chain, populate: () => chain, lean: async () => value };
  return chain;
};
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const student = { _id: 'stable-student', rollNumber: '001', name: 'Student', branch: 'ECE', sectionLabel: 'B', semesterLabel: 'III' };
const report = { _id: 'report', student: student._id, subject: 'subject', department: 'CSE', section: 'A', semester: 'III', attendance: 'P', marksObtained: 0, maxMarks: 10 };
const classQuery = { month: '2026-09', department: 'ECE', section: 'B', semester: 'III', subject: 'subject' };

test('grid retains transferred student zero marks and queries only authorized roster IDs', async (t) => {
  let filter;
  t.mock.method(Student, 'find', () => query([student]));
  t.mock.method(Subject, 'findById', () => query({ _id: 'subject', name: 'Subject', code: 'SUB' }));
  t.mock.method(StudentMonthlyTestReport, 'find', (value) => { filter = value; return query([report]); });
  const res = response();
  await getTestReportGrid({ query: classQuery, user: { role: 'admin' } }, res);
  assert.deepEqual(filter, { month: '2026-09', subject: 'subject', student: { $in: ['stable-student'] } });
  assert.equal(res.body.students[0].report.marksObtained, 0);
  assert.equal(res.body.classSummary.totalStudents, 1);
});

test('grid blocks unauthorized users before reading student marks', async (t) => {
  t.mock.method(StudentMonthlyTestReport, 'find', () => { throw new Error('must not read'); });
  const res = response();
  await getTestReportGrid({ query: classQuery, user: { role: 'trainer' } }, res);
  assert.equal(res.statusCode, 403);
});

test('editing transferred marks retains assessment-time attribution and remarks', async (t) => {
  let operations;
  t.mock.method(Student, 'find', () => query([student]));
  t.mock.method(Subject, 'findById', () => query({ _id: 'subject', name: 'Subject', code: 'SUB' }));
  t.mock.method(StudentMonthlyTestReport, 'bulkWrite', async (value) => { operations = value; });
  const res = response();
  await bulkUpsertTestReports({ body: { ...classQuery, entries: [{ studentId: student._id, marksObtained: 7, maxMarks: 10, attendance: 'P' }] }, user: { _id: 'admin', role: 'admin' } }, res);
  const update = operations[0].updateOne.update;
  assert.equal(update.$set.marksObtained, 7);
  assert.equal(update.$set.department, undefined);
  assert.equal(update.$unset, undefined);
  assert.deepEqual(update.$setOnInsert, { department: 'ECE', section: 'B', semester: 'III' });
});

test('student history retains former department and subject records', async (t) => {
  t.mock.method(Student, 'findById', () => query(student));
  t.mock.method(StudentMonthlyTestReport, 'find', (filter) => { assert.deepEqual(filter, { student: student._id }); return query([report]); });
  const res = response();
  await getStudentTestHistory({ params: { studentId: student._id }, user: { role: 'admin' } }, res);
  assert.equal(res.body.reports[0].department, 'CSE');
  assert.equal(res.body.reports[0].marksObtained, 0);
});

test('student history rejects access outside the trainer roster', async (t) => {
  t.mock.method(Student, 'findById', () => query(student));
  t.mock.method(StudentMonthlyTestReport, 'find', () => { throw new Error('must not read unauthorized marks'); });
  const res = response();
  await getStudentTestHistory({ params: { studentId: student._id }, user: { role: 'trainer' } }, res);
  assert.equal(res.statusCode, 403);
});
