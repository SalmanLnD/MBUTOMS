import Student from '../models/Student.js';
import { FULL_ACCESS_ROLES } from './roles.js';
import { buildStudentAccessFilter, canAccessStudentRecord } from './trainerClassAccess.js';

export const canManageAttendanceRecord = async (user, record, req) => {
  if (FULL_ACCESS_ROLES.includes(user?.role)) return true;
  if (record.type === 'trainer') return Boolean(user?.trainer && String(record.trainer) === String(user.trainer));
  if (record.type !== 'student' || !record.student) return false;
  const student = await Student.findById(record.student).select('branch sectionLabel semesterLabel').lean();
  return Boolean(student && await canAccessStudentRecord(user, student, req));
};

export const scopeAttendanceFilter = async (filter, user, req) => {
  if (FULL_ACCESS_ROLES.includes(user?.role)) return filter;
  const studentFilter = await buildStudentAccessFilter(user, req);
  const students = await Student.find(studentFilter || {}).select('_id').lean();
  const clauses = [{ type: 'student', student: { $in: students.map(s => s._id) } }];
  if (user?.trainer) clauses.push({ type: 'trainer', trainer: user.trainer });
  return { $and: [filter, { $or: clauses }] };
};
