import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import {
  getAttendanceMonthRange,
  normalizeAttendanceDate,
} from './attendanceDates.js';
import {
  getTrainerRrdDateKeys,
  planExcessRrdAttendanceTypes,
} from './replacementRequiredDays.js';
import { TRAINER_ATTENDANCE_TYPES } from './trainerAttendanceTypes.js';

const monthKeyFromDateKey = (dateKey) => String(dateKey || '').slice(0, 7);

const countKeysByMonth = (dateKeys = []) => {
  const counts = new Map();
  dateKeys.forEach((dateKey) => {
    const monthKey = monthKeyFromDateKey(dateKey);
    if (!monthKey) return;
    counts.set(monthKey, (counts.get(monthKey) || 0) + 1);
  });
  return counts;
};

const monthBoundsForDateKeys = (dateKeys = []) => {
  const months = [...new Set(dateKeys.map(monthKeyFromDateKey).filter(Boolean))];
  if (!months.length) return null;
  const ranges = months.map((key) => {
    const [year, month] = key.split('-').map(Number);
    return getAttendanceMonthRange(year, month);
  });
  return ranges.reduce(
    (bounds, range) => ({
      startDate: range.startDate < bounds.startDate ? range.startDate : bounds.startDate,
      endDate: range.endDate > bounds.endDate ? range.endDate : bounds.endDate,
    }),
    { startDate: ranges[0].startDate, endDate: ranges[0].endDate }
  );
};

export const applyDefaultExcessRrdAttendance = async ({ leave, markedBy } = {}) => {
  if (!leave?._id || !leave.trainer) return { eLeaveKeys: [] };

  const trainer = await Trainer.findById(leave.trainer)
    .select('name employeeId scheduleTrainerCodes')
    .lean();
  if (!trainer) return { eLeaveKeys: [] };

  const thisRrdKeys = await getTrainerRrdDateKeys({
    trainer,
    startDate: leave.startDate,
    endDate: leave.endDate,
    onlyLeaveId: leave._id,
  });
  if (!thisRrdKeys.length) return { eLeaveKeys: [] };

  const bounds = monthBoundsForDateKeys(thisRrdKeys);
  const priorRrdKeys = bounds
    ? await getTrainerRrdDateKeys({
      trainer,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      excludeLeaveId: leave._id,
    })
    : [];

  const { eLeaveKeys } = planExcessRrdAttendanceTypes(
    thisRrdKeys,
    countKeysByMonth(priorRrdKeys)
  );
  if (!eLeaveKeys.length) return { eLeaveKeys };

  await Promise.all(eLeaveKeys.map((dateKey) =>
    TrainerDailyAttendance.findOneAndUpdate(
      { trainer: trainer._id, date: normalizeAttendanceDate(dateKey) },
      {
        $set: {
          trainer: trainer._id,
          date: normalizeAttendanceDate(dateKey),
          attendanceType: TRAINER_ATTENDANCE_TYPES.E_LEAVE,
          ...(markedBy ? { markedBy } : {}),
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    )
  ));

  return { eLeaveKeys };
};

export const clearELeaveAttendanceForDateKeys = async ({ trainerId, dateKeys = [] } = {}) => {
  const dates = dateKeys
    .map((dateKey) => normalizeAttendanceDate(dateKey))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (!trainerId || !dates.length) return;

  const logs = await TrainerDailyAttendance.find({
    trainer: trainerId,
    date: { $in: dates },
    attendanceType: TRAINER_ATTENDANCE_TYPES.E_LEAVE,
  });

  await Promise.all(logs.map((log) => {
    if (log.punchInAt) {
      log.attendanceType = TRAINER_ATTENDANCE_TYPES.OIF;
      return log.save();
    }
    return log.deleteOne();
  }));
};
