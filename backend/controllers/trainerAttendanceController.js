import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import {
  clampAttendanceMonthToTrackingStart,
  formatAttendanceMonthKey,
  getAttendanceCalendarDates,
  getAttendanceMonthRange,
  isAttendanceWeekendDate,
  normalizeAttendanceDate,
  parseAttendanceMonthParam,
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from '../utils/attendanceDates.js';
import { getAttendanceToday } from '../utils/attendanceTracking.js';
import { computeClassHandlingHoursBatch } from '../utils/trainerClassHoursBatch.js';
import {
  buildAttendanceGridCacheKey,
  clearAttendanceGridCache,
  getCachedAttendanceGrid,
  setCachedAttendanceGrid,
} from '../utils/attendanceGridCache.js';
import {
  applyItOifAttendanceRules,
  isItOif,
  resolveMockPrepHoursForOif,
} from '../utils/attendanceOifRules.js';

const buildLogMap = (logs) => {
  const map = new Map();
  logs.forEach((log) => {
    map.set(`${log.trainer.toString()}|${toAttendanceDateKey(log.date)}`, log);
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
  const today = getAttendanceToday();
  let { year, month } = parseAttendanceMonthParam(
    req.query.month,
    req.query.referenceDate || new Date()
  );
  ({ year, month } = clampAttendanceMonthToTrackingStart({ year, month }));

  const monthKey = formatAttendanceMonthKey(year, month);
  const semester = req.query.semester || 'III';
  const cacheKey = buildAttendanceGridCacheKey(monthKey, semester, req.user);
  const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';

  if (!bypassCache) {
    const cached = getCachedAttendanceGrid(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  }

  const { startDate: monthStart, endDate: monthEnd } = getAttendanceMonthRange(year, month);
  const rangeStart = monthStart < TRAINER_ATTENDANCE_TRACKING_START
    ? TRAINER_ATTENDANCE_TRACKING_START
    : monthStart;
  const rangeEnd = monthEnd;

  const dates = getAttendanceCalendarDates(rangeStart, rangeEnd);
  const editableDays = dates.filter((date) => date <= today).length;

  const trainerFilter = {};
  if (req.user.role === 'trainer' && req.user.trainer) {
    trainerFilter._id = req.user.trainer;
  }

  const trainers = await Trainer.find(trainerFilter)
    .select('name employeeId scheduleTrainerCodes')
    .sort({ name: 1 })
    .lean();

  const trainerIds = trainers.map((trainer) => trainer._id);
  const dateKeys = dates.map(toAttendanceDateKey);

  const [logs, classHoursCache] = await Promise.all([
    trainerIds.length
      ? TrainerDailyAttendance.find({
        trainer: { $in: trainerIds },
        date: { $gte: rangeStart, $lte: monthEnd },
      }).lean()
      : [],
    computeClassHandlingHoursBatch(trainerIds, dates, semester, trainers),
  ]);

  const logMap = buildLogMap(logs);

  const rows = trainers.map((trainer) => {
    const days = {};

    dates.forEach((date) => {
      const dateKey = toAttendanceDateKey(date);
      const cacheKey = `${trainer._id}|${dateKey}`;
      const log = logMap.get(cacheKey);
      const oifNumber = log?.oifNumber || '';
      const { mockPrepHours, classHandlingHours } = applyItOifAttendanceRules({
        oifNumber,
        mockPrepHours: log?.mockPrepHours ?? 0,
        classHandlingHours: classHoursCache.get(cacheKey) ?? 0,
      });
      days[dateKey] = {
        id: log?._id || null,
        oifNumber,
        mockPrepHours,
        classHandlingHours,
        isFuture: date > today,
      };
    });

    return {
      trainer: {
        _id: trainer._id,
        name: trainer.name,
        employeeId: trainer.employeeId,
      },
      days,
      totals: buildRowTotals(days, dateKeys),
    };
  });

  const payload = {
    month: monthKey,
    monthLabel: new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    }),
    trackingStart: toAttendanceDateKey(TRAINER_ATTENDANCE_TRACKING_START),
    startDate: rangeStart,
    endDate: rangeEnd,
    workingDays: dates.length,
    editableDays,
    dates: dates.map((date) => ({
      key: toAttendanceDateKey(date),
      label: date.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: '2-digit',
      }),
      isFuture: date > today,
      isWeekend: isAttendanceWeekendDate(date),
    })),
    rows,
  };

  setCachedAttendanceGrid(cacheKey, payload);
  res.json(payload);
};

export const upsertTrainerDailyAttendance = async (req, res) => {
  const { trainer, date, oifNumber, mockPrepHours } = req.body;

  if (!trainer || !date) {
    return res.status(400).json({ message: 'Trainer and date are required' });
  }

  if (req.user.role === 'trainer' && req.user.trainer?.toString() !== trainer.toString()) {
    return res.status(403).json({ message: 'Not authorized to update this trainer attendance' });
  }

  const trainerRecord = await Trainer.exists({ _id: trainer });
  if (!trainerRecord) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  const day = normalizeAttendanceDate(date);
  const today = getAttendanceToday();

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

  const trimmedOif = oifNumber?.trim() || '';
  if (trimmedOif.length > 12) {
    return res.status(400).json({ message: 'OIF number must be 12 characters or fewer' });
  }

  const finalMockHours = resolveMockPrepHoursForOif(trimmedOif, parsedMockHours);

  const record = await TrainerDailyAttendance.findOneAndUpdate(
    { trainer, date: day },
    {
      $set: {
        trainer,
        date: day,
        oifNumber: trimmedOif,
        mockPrepHours: finalMockHours,
        markedBy: req.user._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let classHandlingHours = 0;
  if (!isItOif(trimmedOif)) {
    const classHoursCache = await computeClassHandlingHoursBatch(
      [trainer],
      [day],
      'III'
    );
    classHandlingHours = classHoursCache.get(`${trainer.toString()}|${toAttendanceDateKey(day)}`) ?? 0;
  }

  clearAttendanceGridCache();

  const resolved = applyItOifAttendanceRules({
    oifNumber: record.oifNumber,
    mockPrepHours: record.mockPrepHours,
    classHandlingHours,
  });

  res.json({
    id: record._id,
    trainer,
    date: toAttendanceDateKey(day),
    oifNumber: record.oifNumber,
    mockPrepHours: resolved.mockPrepHours,
    classHandlingHours: resolved.classHandlingHours,
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
      filter.punchInAt.$gte = normalizeAttendanceDate(req.query.from);
    }
    if (req.query.to) {
      const end = normalizeAttendanceDate(req.query.to);
      end.setUTCHours(23, 59, 59, 999);
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
    date: toAttendanceDateKey(record.date),
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

export const deleteTrainerPunchInLog = async (req, res) => {
  const record = await TrainerDailyAttendance.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Punch-in log not found' });
  }
  if (!record.punchInAt) {
    return res.status(400).json({ message: 'This attendance entry has no punch-in to remove' });
  }

  await record.deleteOne();

  clearAttendanceGridCache();

  res.json({ message: 'Punch-in log and attendance removed' });
};
