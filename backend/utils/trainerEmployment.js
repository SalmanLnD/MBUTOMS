import { getHiddenRosterTrainerIds } from './rosterFilter.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceDates.js';

export const formatEmploymentMonthKey = (date) => {
  const value = normalizeAttendanceDate(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getCurrentEmploymentMonthKey = () => formatEmploymentMonthKey(new Date());

export const isTrainerVisibleInUi = (trainer, referenceDate = new Date()) => {
  if (!['resigned', 'relocated'].includes(trainer?.employmentStatus)) return true;
  if (!trainer?.includeInAttendanceUntilMonth) return false;
  return trainer.includeInAttendanceUntilMonth >= formatEmploymentMonthKey(referenceDate);
};

export const buildUiTrainerEmploymentFilter = (referenceDate = new Date()) => {
  const currentMonth = formatEmploymentMonthKey(referenceDate);
  return {
    $or: [
      { employmentStatus: { $nin: ['resigned', 'relocated'] } },
      { includeInAttendanceUntilMonth: { $gte: currentMonth } },
    ],
  };
};

export const mergeUiTrainerFilter = async (baseFilter = {}, referenceDate = new Date()) => {
  const employmentClause = buildUiTrainerEmploymentFilter(referenceDate);
  if (!Object.keys(baseFilter).length) return employmentClause;
  return { $and: [baseFilter, employmentClause] };
};

/** Attendance grid UI — same visibility as directory lists. */
export const mergeAttendanceUiTrainerFilter = mergeUiTrainerFilter;

/** Google Sheets export — keep resigned trainers indefinitely for Exit marking. */
export const mergeAttendanceExportTrainerFilter = async (baseFilter = {}) => {
  const hiddenTrainerIds = await getHiddenRosterTrainerIds();
  const exportClause = {
    $or: [
      {
        showInRoster: { $ne: false },
        employmentStatus: { $nin: ['resigned', 'relocated'] },
        ...(hiddenTrainerIds.length ? { _id: { $nin: hiddenTrainerIds } } : {}),
      },
      { employmentStatus: { $in: ['resigned', 'relocated'] } },
    ],
  };

  if (!Object.keys(baseFilter).length) return exportClause;
  return { $and: [baseFilter, exportClause] };
};

export const shouldAutoMarkTrainerRelocated = (trainer, date) => {
  if (trainer?.employmentStatus !== 'relocated' || !trainer?.resignationDate) return false;
  const lastWorkingDate = normalizeAttendanceDate(trainer.resignationDate);
  const day = normalizeAttendanceDate(date);
  return day <= lastWorkingDate;
};

export const shouldAutoMarkTrainerExit = (trainer, date) => {
  if (!trainer?.resignationDate) return false;
  const resignDate = normalizeAttendanceDate(trainer.resignationDate);
  const day = normalizeAttendanceDate(date);

  if (trainer?.employmentStatus === 'resigned') return day >= resignDate;
  if (trainer?.employmentStatus === 'relocated') return day > resignDate;
  return false;
};

/** Days before a trainer's joining date should not inherit timetable class hours. */
export const isBeforeTrainerJoiningDate = (trainer, date) => {
  if (!trainer?.joiningDate) return false;
  const joinDate = normalizeAttendanceDate(trainer.joiningDate);
  const day = normalizeAttendanceDate(date);
  return day < joinDate;
};

export const resignationMonthKeyFromDate = (date) => formatEmploymentMonthKey(date);
