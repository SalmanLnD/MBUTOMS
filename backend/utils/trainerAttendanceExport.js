import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import Leave from '../models/Leave.js';
import Schedule from '../models/Schedule.js';
import {
  getAttendanceCalendarDates,
  getAttendanceMonthRange,
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from './attendanceDates.js';
import { computeClassHandlingHoursBatch } from './trainerClassHoursBatch.js';
import { mergeRosterFilter } from './rosterFilter.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { getLeaveOverlapFilter, isDateWithinLeave } from './leaveDateRange.js';
import { getLeaveWeekdayScheduleIds, isFullDayLeave } from './leaveScope.js';
import { applyItOifAttendanceRules } from './attendanceOifRules.js';
import {
  attendanceTypeUsesOifNumber,
  formatTrainerAttendanceOifDisplay,
  isLeaveAttendanceType,
  TRAINER_ATTENDANCE_TYPES,
} from './trainerAttendanceTypes.js';
import { formatFoodAllowance } from './foodAllowanceTypes.js';

const TRACKING_START_MONTH = '2026-07';
const INITIAL_EXPORT_END_MONTH = '2027-01';
const DAILY_FIELDS = ['OIF', 'Mock', 'Class', 'Food Allowance'];

const monthIndex = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return year * 12 + month - 1;
};

const monthKeyFromIndex = (index) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getAttendanceExportMonthKeys = () => {
  const start = monthIndex(TRACKING_START_MONTH);
  const end = Math.max(
    monthIndex(INITIAL_EXPORT_END_MONTH),
    monthIndex(currentMonthKey())
  );
  return Array.from({ length: end - start + 1 }, (_, offset) =>
    monthKeyFromIndex(start + offset)
  );
};

const formatDateHeader = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

export const buildTrainerAttendanceExportPayload = async () => {
  const monthKeys = getAttendanceExportMonthKeys();
  const [endYear, endMonth] = monthKeys[monthKeys.length - 1].split('-').map(Number);
  const { endDate } = getAttendanceMonthRange(endYear, endMonth);
  const dates = getAttendanceCalendarDates(TRAINER_ATTENDANCE_TRACKING_START, endDate);
  const dateKeys = dates.map(toAttendanceDateKey);

  const trainerRows = await Trainer.find(
    await mergeRosterFilter({}, { rosterOnly: true })
  )
    .select('name employeeId scheduleTrainerCodes')
    .sort({ name: 1 })
    .lean();
  const trainerIds = trainerRows.map((trainer) => trainer._id);
  const codesByTrainer = new Map(
    trainerRows.map((trainer) => [
      trainer._id.toString(),
      resolveTrainerScheduleCodes(trainer),
    ])
  );
  const allScheduleCodes = [...new Set([...codesByTrainer.values()].flat())];

  const [logs, classHours, approvedLeaves, schedules] = await Promise.all([
    TrainerDailyAttendance.find({
      trainer: { $in: trainerIds },
      date: { $gte: TRAINER_ATTENDANCE_TRACKING_START, $lte: endDate },
    }).lean(),
    computeClassHandlingHoursBatch(trainerIds, dates, null, trainerRows),
    Leave.find({
      trainer: { $in: trainerIds },
      status: 'approved',
      ...getLeaveOverlapFilter(TRAINER_ATTENDANCE_TRACKING_START, endDate),
    })
      .select('trainer startDate endDate reason scope affectedSchedules')
      .lean(),
    Schedule.find({ trainerCode: { $in: allScheduleCodes } })
      .select('_id trainerCode day')
      .lean(),
  ]);

  const logsByTrainerDate = new Map(
    logs.map((log) => [
      `${log.trainer.toString()}|${toAttendanceDateKey(log.date)}`,
      log,
    ])
  );
  const schedulesByCode = new Map();
  schedules.forEach((schedule) => {
    if (!schedulesByCode.has(schedule.trainerCode)) {
      schedulesByCode.set(schedule.trainerCode, []);
    }
    schedulesByCode.get(schedule.trainerCode).push(schedule);
  });
  const schedulesByTrainer = new Map(
    trainerRows.map((trainer) => [
      trainer._id.toString(),
      (codesByTrainer.get(trainer._id.toString()) || [])
        .flatMap((code) => schedulesByCode.get(code) || []),
    ])
  );

  const fullDayLeaveKeys = new Set();
  approvedLeaves.forEach((leave) => {
    const trainerId = leave.trainer.toString();
    const dayScheduleIds = getLeaveWeekdayScheduleIds(
      leave,
      schedulesByTrainer.get(trainerId) || []
    );
    if (!isFullDayLeave(leave, { dayScheduleIds })) return;
    dates.forEach((date) => {
      if (isDateWithinLeave(date, leave)) {
        fullDayLeaveKeys.add(`${trainerId}|${toAttendanceDateKey(date)}`);
      }
    });
  });

  const dateHeader = ['Trainer', 'Employee ID'];
  const fieldHeader = ['', ''];
  dateKeys.forEach((dateKey) => {
    dateHeader.push(formatDateHeader(dateKey), '', '', '');
    fieldHeader.push(...DAILY_FIELDS);
  });

  const exportRows = trainerRows.map((trainer) => {
      const trainerId = trainer._id.toString();
      const values = [trainer.name || '', trainer.employeeId || ''];
      dateKeys.forEach((dateKey) => {
        const key = `${trainerId}|${dateKey}`;
        const log = logsByTrainerDate.get(key);
        const onLeave = fullDayLeaveKeys.has(key);
        let attendanceType = log?.attendanceType || TRAINER_ATTENDANCE_TYPES.OIF;
        let oifNumber = log?.oifNumber || '';
        let mockPrepHours = log?.mockPrepHours || 0;
        let classHandlingHours = classHours.get(key) || 0;

        if (onLeave) {
          attendanceType = isLeaveAttendanceType(log?.attendanceType)
            ? log.attendanceType
            : TRAINER_ATTENDANCE_TYPES.LEAVE;
          oifNumber = attendanceTypeUsesOifNumber(attendanceType)
            ? (log?.oifNumber || '')
            : '';
          mockPrepHours = 0;
          classHandlingHours = 0;
        } else {
          const resolved = applyItOifAttendanceRules({
            oifNumber,
            mockPrepHours,
            classHandlingHours,
          });
          mockPrepHours = resolved.mockPrepHours;
          classHandlingHours = resolved.classHandlingHours;
        }

        values.push(
          formatTrainerAttendanceOifDisplay(attendanceType, oifNumber),
          Number(mockPrepHours || 0),
          Number(classHandlingHours || 0),
          formatFoodAllowance(log?.foodAllowance)
        );
      });
      return values;
    });

  return {
    sheetName: 'Trainer Attendance',
    dateGroupSize: DAILY_FIELDS.length,
    frozenRows: 2,
    frozenColumns: 2,
    startMonth: monthKeys[0],
    endMonth: monthKeys[monthKeys.length - 1],
    rows: [dateHeader, fieldHeader, ...exportRows],
  };
};
