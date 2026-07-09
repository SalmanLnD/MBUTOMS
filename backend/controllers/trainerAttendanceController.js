import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import {
  clampMonthToTrackingStart,
  formatMonthKey,
  getCalendarDates,
  getMonthRange,
  groupDatesByWeek,
  isWeekendDate,
  parseMonthParam,
  toDateKey,
} from '../utils/dateRange.js';
import { TRAINER_ATTENDANCE_TRACKING_START } from '../utils/attendanceTracking.js';
import { computeClassHandlingHours } from '../utils/trainerClassHours.js';
import { computeClassHandlingHoursBatch } from '../utils/trainerClassHoursBatch.js';

const buildLogMap = (logs) => {
  const map = new Map();
  logs.forEach((log) => {
    map.set(`${log.trainer.toString()}|${toDateKey(log.date)}`, log);
  });
  return map;
};

const buildRowTotals = (days, dateKeys) => {
  let mockPrepHours = 0;
  let classHandlingHours = 0;
  let oifDays = 0;

  dateKeys.forEach((dateKey) => {
    const cell = days[dateKey];
    if (!cell) return;
    mockPrepHours += Number(cell.mockPrepHours || 0);
    classHandlingHours += Number(cell.classHandlingHours || 0);
    if (String(cell.oifNumber || '').trim()) oifDays += 1;
  });

  return {
    mockPrepHours,
    classHandlingHours,
    oifDays,
    workingDays: dateKeys.length,
  };
};

export const getTrainerAttendanceGrid = async (req, res) => {
  const today = normalizeDate(new Date());
  let { year, month } = parseMonthParam(req.query.month, req.query.referenceDate || new Date());
  ({ year, month } = clampMonthToTrackingStart({ year, month }, TRAINER_ATTENDANCE_TRACKING_START));

  const { startDate: monthStart, endDate: monthEnd } = getMonthRange(year, month);
  const rangeStart = monthStart < TRAINER_ATTENDANCE_TRACKING_START
    ? TRAINER_ATTENDANCE_TRACKING_START
    : monthStart;
  const rangeEnd = monthEnd;

  const dates = getCalendarDates(rangeStart, rangeEnd);
  const editableDays = dates.filter((date) => date <= today).length;
  const semester = req.query.semester || 'III';

  const trainerFilter = {};
  if (req.user.role === 'trainer' && req.user.trainer) {
    trainerFilter._id = req.user.trainer;
  }

  const trainers = await Trainer.find(trainerFilter)
    .select('name employeeId department')
    .populate('department', 'name code')
    .sort({ name: 1 });

  const logs = await TrainerDailyAttendance.find({
    trainer: { $in: trainers.map((trainer) => trainer._id) },
    date: { $gte: rangeStart, $lte: monthEnd },
  });

  const logMap = buildLogMap(logs);
  const classHoursCache = await computeClassHandlingHoursBatch(
    trainers.map((trainer) => trainer._id),
    dates,
    semester
  );
  const dateKeys = dates.map(toDateKey);

  const rows = trainers.map((trainer) => {
    const days = {};

    dates.forEach((date) => {
      const dateKey = toDateKey(date);
      const cacheKey = `${trainer._id}|${dateKey}`;
      const log = logMap.get(cacheKey);
      days[dateKey] = {
        id: log?._id || null,
        oifNumber: log?.oifNumber || '',
        mockPrepHours: log?.mockPrepHours ?? 0,
        classHandlingHours: classHoursCache.get(cacheKey) ?? 0,
        isFuture: date > today,
      };
    });

    return {
      trainer: {
        _id: trainer._id,
        name: trainer.name,
        employeeId: trainer.employeeId,
        department: trainer.department,
      },
      days,
      totals: buildRowTotals(days, dateKeys),
    };
  });

  res.json({
    month: formatMonthKey(year, month),
    monthLabel: new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    }),
    trackingStart: toDateKey(TRAINER_ATTENDANCE_TRACKING_START),
    startDate: rangeStart,
    endDate: rangeEnd,
    workingDays: dates.length,
    editableDays,
    dates: dates.map((date) => ({
      key: toDateKey(date),
      label: date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit' }),
      isFuture: date > today,
      isWeekend: isWeekendDate(date),
    })),
    weeks: groupDatesByWeek(dates),
    rows,
  });
};

export const upsertTrainerDailyAttendance = async (req, res) => {
  const { trainer, date, oifNumber, mockPrepHours } = req.body;

  if (!trainer || !date) {
    return res.status(400).json({ message: 'Trainer and date are required' });
  }

  if (req.user.role === 'trainer' && req.user.trainer?.toString() !== trainer.toString()) {
    return res.status(403).json({ message: 'Not authorized to update this trainer attendance' });
  }

  const trainerRecord = await Trainer.findById(trainer);
  if (!trainerRecord) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  const day = normalizeDate(date);
  const today = normalizeDate(new Date());

  if (day < TRAINER_ATTENDANCE_TRACKING_START) {
    return res.status(400).json({
      message: 'Attendance tracking starts from 1 July 2026.',
    });
  }

  if (day > today) {
    return res.status(400).json({ message: 'Future dates cannot be marked.' });
  }

  const parsedMockHours = mockPrepHours === '' || mockPrepHours === null || mockPrepHours === undefined
    ? 0
    : Number(mockPrepHours);

  if (Number.isNaN(parsedMockHours) || parsedMockHours < 0) {
    return res.status(400).json({ message: 'Mock or preparation hours must be a valid number' });
  }

  const record = await TrainerDailyAttendance.findOneAndUpdate(
    { trainer, date: day },
    {
      trainer,
      date: day,
      oifNumber: oifNumber?.trim() || '',
      mockPrepHours: parsedMockHours,
      markedBy: req.user._id,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const classHandlingHours = await computeClassHandlingHours(trainer, day);

  res.json({
    id: record._id,
    trainer,
    date: toDateKey(day),
    oifNumber: record.oifNumber,
    mockPrepHours: record.mockPrepHours,
    classHandlingHours,
  });
};

export const getTrainerPunchInLogs = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {
    punchInAt: { $exists: true, $ne: null },
  };

  if (req.user.role === 'trainer' && req.user.trainer) {
    filter.trainer = req.user.trainer;
  } else if (req.query.trainer) {
    filter.trainer = req.query.trainer;
  }

  if (req.query.source && ['whatsapp', 'manual'].includes(req.query.source)) {
    filter.punchInSource = req.query.source;
  }

  if (req.query.from || req.query.to) {
    filter.punchInAt = { ...filter.punchInAt };
    if (req.query.from) {
      filter.punchInAt.$gte = normalizeDate(req.query.from);
    }
    if (req.query.to) {
      const end = normalizeDate(req.query.to);
      end.setHours(23, 59, 59, 999);
      filter.punchInAt.$lte = end;
    }
  }

  if (req.query.search && req.user.role !== 'trainer') {
    const search = String(req.query.search).trim();
    if (search) {
      const matchingTrainers = await Trainer.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      const trainerIds = matchingTrainers.map((t) => t._id);
      if (trainerIds.length === 0) {
        return res.json({
          logs: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }
      if (filter.trainer) {
        const allowed = trainerIds.some((id) => id.toString() === filter.trainer.toString());
        if (!allowed) {
          return res.json({
            logs: [],
            pagination: { page, limit, total: 0, pages: 0 },
          });
        }
      } else {
        filter.trainer = { $in: trainerIds };
      }
    }
  }

  const [records, total] = await Promise.all([
    TrainerDailyAttendance.find(filter)
      .populate('trainer', 'name employeeId department')
      .populate('trainer.department', 'name code')
      .sort({ punchInAt: -1 })
      .skip(skip)
      .limit(limit),
    TrainerDailyAttendance.countDocuments(filter),
  ]);

  const logs = records.map((record) => ({
    id: record._id,
    trainer: record.trainer
      ? {
          _id: record.trainer._id,
          name: record.trainer.name,
          employeeId: record.trainer.employeeId,
          department: record.trainer.department,
        }
      : null,
    date: toDateKey(record.date),
    oifNumber: record.oifNumber || '',
    punchInAt: record.punchInAt,
    punchInSource: record.punchInSource || 'manual',
    punchInRawPhone: record.punchInRawPhone || '',
    punchInImageUrl: record.punchInImageUrl || '',
    mockPrepHours: record.mockPrepHours ?? 0,
    recordedAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));

  res.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  });
};
