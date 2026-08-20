import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceDates.js';
import { formatEmploymentMonthKey } from './trainerEmployment.js';

const unionRanges = (ranges) => {
  if (!ranges.length) return null;
  const absoluteFrom = ranges.reduce((min, row) => (row.from < min ? row.from : min), ranges[0].from);
  const absoluteTo = ranges.reduce((max, row) => (row.to > max ? row.to : max), ranges[0].to);
  return { from: absoluteFrom, to: absoluteTo };
};

/**
 * Build continuous attendance windows for trainers created via bulk external replacement.
 * Source of truth is Leave.bulkReplacement; Trainer flags are kept in sync for filtering.
 */
export const loadBulkReplacementAttendanceWindows = async () => {
  const leaves = await Leave.find({
    'bulkReplacement.replacementTrainer': { $exists: true, $ne: null },
    'bulkReplacement.fromDate': { $ne: null },
    'bulkReplacement.toDate': { $ne: null },
  })
    .select('bulkReplacement')
    .lean();

  const rangesByTrainer = new Map();
  leaves.forEach((leave) => {
    const meta = leave.bulkReplacement;
    const trainerId = meta?.replacementTrainer?.toString?.();
    if (!trainerId || !meta.fromDate || !meta.toDate) return;
    if (!rangesByTrainer.has(trainerId)) rangesByTrainer.set(trainerId, []);
    rangesByTrainer.get(trainerId).push({
      from: normalizeAttendanceDate(meta.fromDate),
      to: normalizeAttendanceDate(meta.toDate),
    });
  });

  if (!rangesByTrainer.size) return new Map();

  const trainers = await Trainer.find({ _id: { $in: [...rangesByTrainer.keys()] } })
    .select('_id createdAsBulkReplacement subjects scheduleTrainerCodes joiningDate replacementAttendanceFrom replacementAttendanceTo includeInAttendanceUntilMonth')
    .lean();

  const windows = new Map();
  const backfills = [];

  trainers.forEach((trainer) => {
    const trainerId = trainer._id.toString();
    const union = unionRanges(rangesByTrainer.get(trainerId) || []);
    if (!union) return;

    const looksLikeExternalCreate = trainer.createdAsBulkReplacement
      || (
        !(trainer.subjects || []).length
        && !(trainer.scheduleTrainerCodes || []).length
      );

    if (!looksLikeExternalCreate) return;

    windows.set(trainerId, union);

    const needsFlag = !trainer.createdAsBulkReplacement;
    const needsFrom = !trainer.replacementAttendanceFrom
      || normalizeAttendanceDate(trainer.replacementAttendanceFrom).getTime() !== union.from.getTime();
    const needsTo = !trainer.replacementAttendanceTo
      || normalizeAttendanceDate(trainer.replacementAttendanceTo).getTime() !== union.to.getTime();
    const untilMonth = formatEmploymentMonthKey(union.to);
    const needsUntil = trainer.includeInAttendanceUntilMonth !== untilMonth;
    const needsJoin = !trainer.joiningDate
      || normalizeAttendanceDate(trainer.joiningDate).getTime() > union.from.getTime();

    if (needsFlag || needsFrom || needsTo || needsUntil || needsJoin) {
      backfills.push({
        updateOne: {
          filter: { _id: trainer._id },
          update: {
            $set: {
              createdAsBulkReplacement: true,
              replacementAttendanceFrom: union.from,
              replacementAttendanceTo: union.to,
              includeInAttendanceUntilMonth: untilMonth,
              ...(needsJoin ? { joiningDate: union.from } : {}),
            },
          },
        },
      });
    }
  });

  if (backfills.length) {
    await Trainer.bulkWrite(backfills, { ordered: false });
  }

  return windows;
};

export const isBulkReplacementOnlyTrainer = (trainer, windows) => {
  if (!trainer) return false;
  if (trainer.createdAsBulkReplacement) return true;
  return windows?.has(trainer._id?.toString?.() || trainer.toString());
};

export const replacementWindowOverlapsRange = (window, rangeStart, rangeEnd) => {
  if (!window?.from || !window?.to) return false;
  const start = normalizeAttendanceDate(rangeStart);
  const end = normalizeAttendanceDate(rangeEnd);
  return window.from <= end && window.to >= start;
};

export const isDateInsideReplacementWindow = (window, date) => {
  if (!window?.from || !window?.to) return false;
  const day = normalizeAttendanceDate(date);
  return day >= window.from && day <= window.to;
};

export const filterTrainersForBulkReplacementWindows = ({
  trainers,
  windows,
  rangeStart,
  rangeEnd,
}) => trainers.filter((trainer) => {
  const trainerId = trainer._id.toString();
  const window = windows.get(trainerId);
  if (!isBulkReplacementOnlyTrainer(trainer, windows)) return true;
  if (!window) return false;
  return replacementWindowOverlapsRange(window, rangeStart, rangeEnd);
});

export const buildOtherBaseAttendanceCell = ({ date, today, logId = null } = {}) => ({
  id: logId,
  attendanceType: 'other_base',
  oifNumber: '',
  oifDisplay: 'Other base',
  foodAllowance: '',
  mockPrepHours: 0,
  classHandlingHours: 0,
  isOnLeave: false,
  isDefaultWeekOff: false,
  isSundayWeekOff: false,
  classHoursEditable: false,
  isReplacementRequired: false,
  isOtherBase: true,
  isFuture: today ? date > today : false,
});

export const describeReplacementWindow = (window) => {
  if (!window) return null;
  return {
    from: toAttendanceDateKey(window.from),
    to: toAttendanceDateKey(window.to),
  };
};
