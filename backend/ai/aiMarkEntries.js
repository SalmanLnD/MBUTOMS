import Student from '../models/Student.js';
import StudentMonthlyTestReport from '../models/StudentMonthlyTestReport.js';
import { getClasses } from '../controllers/classController.js';
import { getTestReportSubjects, getTestReportGrid } from '../controllers/studentTestReportController.js';
import { resolveAttendance } from '../utils/studentTestReportConstants.js';

export const summarizeMarkEntries = (students, reports) => {
  const byStudent = new Map(reports.map(row => [String(row.student), row]));
  let entered = 0;
  let absent = 0;
  for (const student of students) {
    const report = byStudent.get(String(student._id));
    if (!report) continue;
    if (resolveAttendance(report) === 'A') absent++;
    else if (Number.isFinite(report.marksObtained)) entered++;
  }
  const totalStudents = students.length;
  const pending = totalStudents - entered - absent;
  return { totalStudents, entered, absent, pending, status: !totalStudents ? 'no_students'
    : pending === totalStudents ? 'completely_pending' : pending ? 'partially_pending' : 'complete' };
};

export const readMarkEntries = async (req, args, read) => {
  const classes = await read(getClasses, req, { semester: args.semester, status: 'active' });
  if (classes.error) return classes;
  const rows = [];
  await Promise.all(classes.filter(c => (!args.department || c.department.toLowerCase() === args.department.toLowerCase())
    && (!args.section || c.section.toLowerCase() === args.section.toLowerCase())).map(async (cls) => {
    const query = { department: cls.department, section: cls.section, semester: cls.currentSemester };
    const subjects = await read(getTestReportSubjects, req, query);
    if (subjects.error) throw new Error('Authorized subjects unavailable');
    const students = await Student.find({ status: 'active', branch: cls.department, sectionLabel: cls.section,
      semesterLabel: cls.currentSemester, ...(cls.py ? { py: cls.py } : {}) }).select('_id').lean();
    const allowedSubjects = subjects.filter(s => !args.subjectCode || s.code === args.subjectCode);
    const reports = await StudentMonthlyTestReport.find({ ...query, month: args.month,
      subject: { $in: allowedSubjects.map(s => s._id) } }).select('student subject marksObtained attendance remarks').lean();
    for (const subject of allowedSubjects) rows.push({ ...query, py: cls.py, subject: subject.name, subjectCode: subject.code,
      ...summarizeMarkEntries(students, reports.filter(r => String(r.subject) === String(subject._id))) });
  }));
  rows.sort((a, b) => [a.department, a.section, a.semester, a.subjectCode].join('|').localeCompare([b.department, b.section, b.semester, b.subjectCode].join('|')));
  const matching = rows.filter(r => !args.entryStatus || r.status === args.entryStatus);
  return { month: args.month, basis: 'Current active student roster and timetable subjects; recorded absence or numeric zero counts as entered. Not topic-tracker closure.',
    totalClassSubjects: rows.length, matchingClassSubjects: matching.length,
    completelyPendingClassSubjects: rows.filter(r => r.status === 'completely_pending').length,
    rows: matching.slice(0, 100), truncated: matching.length > 100 };
};

export const readClassStudents = async (req, args, read) => {
  const query = { month: args.month, department: args.department, section: args.section, semester: args.semester };
  const subjects = await read(getTestReportSubjects, req, query);
  if (subjects.error) return subjects;
  const matches = subjects.filter(s => s.code === args.subjectCode);
  if (matches.length !== 1) return { error: 'not_found', message: 'No unique authorized subject found for this class.' };
  const grid = await read(getTestReportGrid, req, { ...query, subject: String(matches[0]._id) });
  if (grid.error) return grid;
  return { month: grid.month, class: grid.class, subject: grid.subject.name, totalStudents: grid.students.length,
    students: grid.students.slice(0, 50).map(s => ({ name: s.name, rollNumber: s.rollNumber, report: s.report ? {
      attendance: s.report.attendance, marksObtained: s.report.marksObtained, maxMarks: s.report.maxMarks, result: s.report.result } : null })),
    truncated: grid.students.length > 50 };
};
