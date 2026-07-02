import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { timesOverlap } from '../utils/timetableSlots.js';
import { buildTrainerSchedulesForDate } from '../utils/trainerScheduleView.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';

const DAY_ORDER = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const sortSchedules = (schedules) =>
  [...schedules].sort(
    (a, b) =>
      (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99) ||
      a.startTime.localeCompare(b.startTime)
  );

const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const computeHours = (startTime, endTime) => {
  const diff = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return Math.max(0, diff / 60);
};

const buildFilter = async (query) => {
  const filter = {};
  if (query.trainerCode) filter.trainerCode = query.trainerCode;
  if (query.day) filter.day = query.day;
  if (query.department) filter.department = query.department;
  if (query.semester) filter.semester = query.semester;
  if (query.subjectCode) filter.subjectCode = query.subjectCode;

  if (query.trainer) {
    const trainer = await Trainer.findById(query.trainer);
    if (trainer) {
      const codes = resolveTrainerScheduleCodes(trainer);
      filter.trainerCode = codes.length === 1 ? codes[0] : { $in: codes };
    }
  }

  return filter;
};

const findTrainerTimeConflict = async ({
  trainerCode,
  day,
  startTime,
  endTime,
  excludeId,
}) => {
  const query = { trainerCode, day };
  if (excludeId) query._id = { $ne: excludeId };

  const sameDay = await Schedule.find(query);
  return sameDay.find((entry) =>
    timesOverlap(startTime, endTime, entry.startTime, entry.endTime)
  );
};

const formatConflictMessage = (conflict) => {
  const subjectPart = conflict.subjectCode ? ` (${conflict.subjectCode})` : '';
  return `Trainer already has ${conflict.department} ${conflict.section}${subjectPart} on ${conflict.day} from ${conflict.startTime} to ${conflict.endTime}. A trainer cannot be in two places at the same time.`;
};

const enrichSchedulePayload = async (body) => {
  const payload = { ...body };

  if (payload.startTime >= payload.endTime) {
    const error = new Error('End time must be after start time');
    error.statusCode = 400;
    throw error;
  }

  if (payload.subject) {
    const subject = await Subject.findById(payload.subject);
    if (subject) {
      payload.subjectCode = subject.code;
    }
  } else if (payload.subjectCode) {
    const subject = await Subject.findOne({ code: payload.subjectCode });
    if (subject) {
      payload.subject = subject._id;
    }
  }

  return payload;
};

export const getSchedules = async (req, res) => {
  const referenceDate = req.query.referenceDate || new Date();

  if (req.query.trainerCode || req.query.trainer) {
    const schedules = await buildTrainerSchedulesForDate({
      trainerCode: req.query.trainerCode,
      trainerId: req.query.trainer,
      referenceDate,
      semester: req.query.semester,
    });
    return res.json(sortSchedules(schedules));
  }

  const filter = await buildFilter(req.query);
  const schedules = sortSchedules(await Schedule.find(filter));
  res.json(schedules);
};

export const getScheduleById = async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  res.json(schedule);
};

export const getTrainerSchedule = async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) return res.status(404).json({ message: 'Trainer not found' });

  const referenceDate = req.query.referenceDate || new Date();
  const enriched = await buildTrainerSchedulesForDate({
    trainerId: trainer._id,
    referenceDate,
    semester: req.query.semester,
  });

  const totalHours = enriched.reduce(
    (sum, s) => sum + computeHours(s.startTime, s.endTime),
    0
  );

  res.json({ schedules: enriched, totalHours, count: enriched.length });
};

export const getTrainerScheduleByCode = async (req, res) => {
  const referenceDate = req.query.referenceDate || new Date();
  const enriched = await buildTrainerSchedulesForDate({
    trainerCode: req.params.code,
    referenceDate,
    semester: req.query.semester,
  });
  const totalHours = enriched.reduce(
    (sum, s) => sum + computeHours(s.startTime, s.endTime),
    0
  );
  res.json({ schedules: enriched, totalHours, count: enriched.length });
};

export const createSchedule = async (req, res) => {
  let payload;
  try {
    payload = await enrichSchedulePayload(req.body);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message });
  }

  const conflict = await findTrainerTimeConflict({
    trainerCode: payload.trainerCode,
    day: payload.day,
    startTime: payload.startTime,
    endTime: payload.endTime,
  });
  if (conflict) {
    return res.status(409).json({ message: formatConflictMessage(conflict) });
  }

  const schedule = await Schedule.create(payload);
  res.status(201).json(schedule);
};

export const updateSchedule = async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

  let payload;
  try {
    payload = await enrichSchedulePayload({ ...schedule.toObject(), ...req.body });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message });
  }

  const conflict = await findTrainerTimeConflict({
    trainerCode: payload.trainerCode,
    day: payload.day,
    startTime: payload.startTime,
    endTime: payload.endTime,
    excludeId: schedule._id,
  });
  if (conflict) {
    return res.status(409).json({ message: formatConflictMessage(conflict) });
  }

  Object.assign(schedule, payload);
  await schedule.save();
  res.json(schedule);
};

export const deleteSchedule = async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  await schedule.deleteOne();
  res.json({ message: 'Schedule removed' });
};

export const getBatches = async (req, res) => {
  const batches = await Schedule.aggregate([
    { $group: { _id: { department: '$department', section: '$section' } } },
    { $sort: { '_id.department': 1, '_id.section': 1 } },
    {
      $project: {
        _id: 0,
        name: { $concat: ['$_id.department', ' ', '$_id.section'] },
        department: '$_id.department',
        section: '$_id.section',
      },
    },
  ]);
  res.json(batches);
};
