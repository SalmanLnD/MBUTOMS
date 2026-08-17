import OfficialHoliday from '../models/OfficialHoliday.js';
import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from './attendanceDates.js';
import { mergeRosterFilter } from './rosterFilter.js';
import {
  mergeAttendanceUiTrainerFilter,
  shouldAutoMarkTrainerExit,
  isBeforeTrainerJoiningDate,
} from './trainerEmployment.js';
import { TRAINER_ATTENDANCE_TYPES } from './trainerAttendanceTypes.js';

export const loadOfficialHolidayMap = async (startDate, endDate) => {
  const holidays = await OfficialHoliday.find({
    date: { $gte: startDate, $lte: endDate },
  })
    .select('date name')
    .lean();

  return new Map(
    holidays.map((holiday) => [toAttendanceDateKey(holiday.date), holiday.name || 'Official leave'])
  );
};

export const isWorkedOfficialHoliday = (log) => {
  if (!log) return false;
  if (log.punchInAt) return true;
  if (log.attendanceType === TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF) return true;
  if (log.attendanceType === TRAINER_ATTENDANCE_TYPES.OIF && String(log.oifNumber || '').trim()) {
    return true;
  }
  return false;
};

export const resolveOfficialHolidayAttendance = (log) => {
  if (isWorkedOfficialHoliday(log)) {
    const attendanceType = log.attendanceType === TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF
      || log.attendanceType === TRAINER_ATTENDANCE_TYPES.OIF
      ? TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF
      : (log.attendanceType || TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF);
    return {
      attendanceType: attendanceType === TRAINER_ATTENDANCE_TYPES.HOLIDAY
        ? TRAINER_ATTENDANCE_TYPES.HOLIDAY_OIF
        : attendanceType,
      isNonWorking: false,
    };
  }

  return {
    attendanceType: TRAINER_ATTENDANCE_TYPES.HOLIDAY,
    isNonWorking: true,
  };
};

const rosterTrainersForDate = async (day) => {
  const filter = await mergeAttendanceUiTrainerFilter(
    await mergeRosterFilter({}, { rosterOnly: true }),
    day
  );
  return Trainer.find(filter)
    .select('_id joiningDate employmentStatus resignationDate includeInAttendanceUntilMonth')
    .lean();
};

export const markRosterOfficialHoliday = async (dateInput) => {
  const day = normalizeAttendanceDate(dateInput);
  const trainers = await rosterTrainersForDate(day);
  const trainerIds = trainers.map((trainer) => trainer._id);
  const existing = trainerIds.length
    ? await TrainerDailyAttendance.find({
      trainer: { $in: trainerIds },
      date: day,
    })
      .select('trainer attendanceType punchInAt oifNumber')
      .lean()
    : [];
  const skipIds = new Set(
    existing
      .filter((row) => isWorkedOfficialHoliday(row))
      .map((row) => row.trainer.toString())
  );

  const ops = trainers
    .filter((trainer) => {
      if (skipIds.has(trainer._id.toString())) return false;
      if (isBeforeTrainerJoiningDate(trainer, day)) return false;
      if (shouldAutoMarkTrainerExit(trainer, day)) return false;
      return true;
    })
    .map((trainer) => ({
      updateOne: {
        filter: { trainer: trainer._id, date: day },
        update: {
          $set: {
            attendanceType: TRAINER_ATTENDANCE_TYPES.HOLIDAY,
            oifNumber: '',
            mockPrepHours: 0,
            classHandlingHours: 0,
            foodAllowance: '',
          },
        },
        upsert: true,
      },
    }));

  if (ops.length) {
    await TrainerDailyAttendance.bulkWrite(ops, { ordered: false });
  }
  return { marked: ops.length };
};

export const unmarkRosterOfficialHoliday = async (dateInput) => {
  const day = normalizeAttendanceDate(dateInput);
  const result = await TrainerDailyAttendance.deleteMany({
    date: day,
    attendanceType: TRAINER_ATTENDANCE_TYPES.HOLIDAY,
    $or: [{ punchInAt: { $exists: false } }, { punchInAt: null }],
  });
  return { removed: result.deletedCount || 0 };
};
