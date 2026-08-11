import { getHiddenRosterTrainerIds } from './rosterFilter.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceDates.js';

export const formatEmploymentMonthKey = (date) => {
  const value = normalizeAttendanceDate(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getCurrentEmploymentMonthKey = () => formatEmploymentMonthKey(new Date());

export const isTrainerVisibleInUi = (trainer, referenceDate = new Date()) => {
  if (trainer?.employmentStatus !== 'resigned') return true;
  if (!trainer?.includeInAttendanceUntilMonth) return false;
  return trainer.includeInAttendanceUntilMonth >= formatEmploymentMonthKey(referenceDate);
};

export const buildUiTrainerEmploymentFilter = (referenceDate = new Date()) => {
  const currentMonth = formatEmploymentMonthKey(referenceDate);
  return {
    $or: [
      { employmentStatus: { $ne: 'resigned' } },
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
        employmentStatus: { $ne: 'resigned' },
        ...(hiddenTrainerIds.length ? { _id: { $nin: hiddenTrainerIds } } : {}),
      },
      { employmentStatus: 'resigned' },
    ],
  };

  if (!Object.keys(baseFilter).length) return exportClause;
  return { $and: [baseFilter, exportClause] };
};

export const shouldAutoMarkTrainerExit = (trainer, date) => {
  if (trainer?.employmentStatus !== 'resigned' || !trainer?.resignationDate) return false;
  const resignDate = normalizeAttendanceDate(trainer.resignationDate);
  const day = normalizeAttendanceDate(date);
  return day >= resignDate;
};

export const resignationMonthKeyFromDate = (date) => formatEmploymentMonthKey(date);
