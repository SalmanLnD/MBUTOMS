import Department from '../models/Department.js';

const toId = (value) => value?._id || value || null;

export const getAllowedDepartmentCodesForSubject = async (subject) => {
  if (!subject) return null;

  const schoolIds = (subject.schools || []).map(toId).filter(Boolean);

  if (subject.allDepartments) {
    if (!schoolIds.length) return null;
    const departments = await Department.find({ school: { $in: schoolIds } }).select('code');
    const codes = departments.map((dept) => dept.code).filter(Boolean);
    return codes.length ? codes : null;
  }

  const departments = subject.departments || [];
  if (!departments.length) return null;

  const populatedCodes = departments
    .map((dept) => (typeof dept === 'object' && dept.code ? dept.code : null))
    .filter(Boolean);

  if (populatedCodes.length) return populatedCodes;

  const departmentIds = departments.map(toId).filter(Boolean);
  if (!departmentIds.length) return null;

  const docs = await Department.find({ _id: { $in: departmentIds } }).select('code');
  const codes = docs.map((dept) => dept.code).filter(Boolean);
  return codes.length ? codes : null;
};

export const assertClassAllowedForSubject = async (subject, departmentCode) => {
  const allowed = await getAllowedDepartmentCodesForSubject(subject);
  if (!allowed) return;

  const dept = String(departmentCode || '').trim();
  if (!allowed.includes(dept)) {
    const error = new Error(
      `Class "${dept}" is not assigned to this subject. Allowed departments: ${allowed.join(', ')}.`
    );
    error.statusCode = 400;
    throw error;
  }
};
