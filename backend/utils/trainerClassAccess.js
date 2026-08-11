import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import { FULL_ACCESS_ROLES, isAuthorizedRole } from './roles.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { normalizeSemesterKey } from './studentCountByClass.js';

export const CLASSES_VIEW_ALL_ROLES = [...FULL_ACCESS_ROLES, 'subject_coordinator'];

export const canViewAllClasses = (user) =>
  isAuthorizedRole(user?.role, CLASSES_VIEW_ALL_ROLES);

export const buildClassKey = (department, section, semester) =>
  `${department}|${section}|${normalizeSemesterKey(semester)}`;

const expandDepartmentBranches = (department) => {
  if (department === 'ECE & EIE') return ['ECE', 'EIE'];
  if (department === 'CE & ME' || department === 'CE-ME') return ['CE', 'ME', 'CE-ME', 'CE & ME'];
  if (department === 'B.COM(CA)') return ['B.COM(CA)', 'BCOM-CA'];
  if (department === 'BCOM-CA') return ['BCOM-CA', 'B.COM(CA)'];
  return [department];
};

const SEMESTER_NUMBER_BY_LABEL = {
  I: '1',
  II: '2',
  III: '3',
  IV: '4',
  V: '5',
  VI: '6',
  VII: '7',
  VIII: '8',
};

const semesterMatchValues = (semester) => {
  const normalized = normalizeSemesterKey(semester);
  const values = new Set([normalized]);
  const raw = String(semester || '').trim();
  if (raw) values.add(raw);
  const asNumber = SEMESTER_NUMBER_BY_LABEL[normalized];
  if (asNumber) values.add(asNumber);
  return [...values].filter(Boolean);
};

export const getTrainerScheduleCodes = async (trainerId) => {
  if (!trainerId) return [];
  const trainer = await Trainer.findById(trainerId)
    .select('employeeId scheduleTrainerCodes name')
    .lean();
  if (!trainer) return [];
  return resolveTrainerScheduleCodes(trainer);
};

export const getTrainerScheduleCodesCached = async (req, trainerId) => {
  if (!req?._trainerScheduleCodes) {
    req._trainerScheduleCodes = await getTrainerScheduleCodes(trainerId);
  }
  return req._trainerScheduleCodes;
};

export const getTrainerClassKeys = async (trainerId, req) => {
  const codes = req
    ? await getTrainerScheduleCodesCached(req, trainerId)
    : await getTrainerScheduleCodes(trainerId);
  if (!codes.length) return new Set();

  const schedules = await Schedule.find({ trainerCode: { $in: codes } })
    .select('department section semester')
    .lean();

  return new Set(
    schedules.map((schedule) =>
      buildClassKey(schedule.department, schedule.section, schedule.semester)
    )
  );
};

export const filterClassesForUser = async (classes, user, req) => {
  if (canViewAllClasses(user)) return classes;
  if (!user?.trainer) return [];

  const allowed = await getTrainerClassKeys(user.trainer, req);
  return classes.filter((cls) =>
    allowed.has(buildClassKey(cls.department, cls.section, cls.currentSemester))
  );
};

export const canAccessClass = async (user, department, section, semester, req) => {
  if (canViewAllClasses(user)) return true;
  if (!user?.trainer) return false;
  const allowed = await getTrainerClassKeys(user.trainer, req);
  return allowed.has(buildClassKey(department, section, semester));
};

export const buildStudentAccessOrClauses = (classKeys) => {
  const orClauses = [];

  classKeys.forEach((key) => {
    const [department, section, semester] = key.split('|');
    const branches = expandDepartmentBranches(department);
    const semesters = semesterMatchValues(semester);

    orClauses.push({
      branch: branches.length === 1 ? branches[0] : { $in: branches },
      sectionLabel: section,
      semesterLabel: semesters.length === 1 ? semesters[0] : { $in: semesters },
    });
  });

  return orClauses;
};

export const buildStudentAccessFilter = async (user, req) => {
  if (canViewAllClasses(user)) return null;
  if (!user?.trainer) return { _id: null };

  const classKeys = await getTrainerClassKeys(user.trainer, req);
  if (!classKeys.size) return { _id: null };

  return { $or: buildStudentAccessOrClauses(classKeys) };
};

export const studentMatchesClassKey = (student, classKeyValue) => {
  const [department, section, semester] = classKeyValue.split('|');
  const branches = expandDepartmentBranches(department);
  const semesters = semesterMatchValues(semester);

  return (
    branches.includes(student.branch)
    && student.sectionLabel === section
    && semesters.includes(normalizeSemesterKey(student.semesterLabel))
  );
};

export const canAccessStudentRecord = async (user, student, req) => {
  if (canViewAllClasses(user)) return true;
  if (!user?.trainer || !student) return false;

  const classKeys = await getTrainerClassKeys(user.trainer, req);
  if (!classKeys.size) return false;

  return [...classKeys].some((key) => studentMatchesClassKey(student, key));
};

export const mergeWithStudentAccessFilter = async (baseFilter, user, req) => {
  const accessFilter = await buildStudentAccessFilter(user, req);
  if (!accessFilter) return baseFilter;
  if (accessFilter._id === null) return accessFilter;

  if (!Object.keys(baseFilter).length) return accessFilter;
  return { $and: [baseFilter, accessFilter] };
};

export const getTrainerSubjectIdsForClass = async (trainerId, department, section, semester, req) => {
  const codes = req
    ? await getTrainerScheduleCodesCached(req, trainerId)
    : await getTrainerScheduleCodes(trainerId);
  if (!codes.length) return new Set();

  const schedules = await Schedule.find({
    trainerCode: { $in: codes },
    department,
    section,
    semester,
  }).select('subject').lean();

  return new Set(
    schedules.map((schedule) => String(schedule.subject)).filter(Boolean)
  );
};

export const canAccessSubject = async (user, subjectId, department, section, semester, req) => {
  if (canViewAllClasses(user)) return true;
  if (!user?.trainer || !subjectId) return false;
  const allowed = await getTrainerSubjectIdsForClass(
    user.trainer,
    department,
    section,
    semester,
    req
  );
  return allowed.has(String(subjectId));
};

export const classAccessHelpers = {
  canViewAll: canViewAllClasses,
  getTrainerClassKeys,
};
