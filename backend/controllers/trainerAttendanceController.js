import Trainer from '../models/Trainer.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import { getWeekdayDates, getWeekRange, toDateKey } from '../utils/dateRange.js';
import { computeClassHandlingHours } from '../utils/trainerClassHours.js';

const buildLogMap = (logs) => {
  const map = new Map();
  logs.forEach((log) => {
    map.set(`${log.trainer.toString()}|${toDateKey(log.date)}`, log);
  });
  return map;
};

export const getTrainerAttendanceGrid = async (req, res) => {
  const weekRange = req.query.startDate && req.query.endDate
    ? { startDate: normalizeDate(req.query.startDate), endDate: normalizeDate(req.query.endDate) }
    : getWeekRange(req.query.referenceDate || new Date());

  const { startDate, endDate } = weekRange;
  const dates = getWeekdayDates(startDate, endDate);
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
    date: { $gte: startDate, $lte: endDate },
  });

  const logMap = buildLogMap(logs);
  const classHoursCache = new Map();

  const rows = await Promise.all(
    trainers.map(async (trainer) => {
      const days = {};

      await Promise.all(
        dates.map(async (date) => {
          const dateKey = toDateKey(date);
          const cacheKey = `${trainer._id}|${dateKey}`;
          let classHandlingHours = classHoursCache.get(cacheKey);
          if (classHandlingHours === undefined) {
            classHandlingHours = await computeClassHandlingHours(trainer._id, date, semester);
            classHoursCache.set(cacheKey, classHandlingHours);
          }

          const log = logMap.get(cacheKey);
          days[dateKey] = {
            id: log?._id || null,
            oifNumber: log?.oifNumber || '',
            mockPrepHours: log?.mockPrepHours ?? 0,
            classHandlingHours,
          };
        })
      );

      return {
        trainer: {
          _id: trainer._id,
          name: trainer.name,
          employeeId: trainer.employeeId,
          department: trainer.department,
        },
        days,
      };
    })
  );

  res.json({
    startDate,
    endDate,
    dates: dates.map((date) => ({
      key: toDateKey(date),
      label: date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }),
    })),
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
