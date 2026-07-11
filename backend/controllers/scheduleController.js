import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import Venue from '../models/Venue.js';
import { timesOverlap } from '../utils/timetableSlots.js';
import { buildTrainerSchedulesForDate } from '../utils/trainerScheduleView.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';
import { assertClassRegistered } from '../utils/classRegistry.js';
import { assertClassAllowedForSubject } from '../utils/subjectClassEligibility.js';
import ClassGroup from '../models/ClassGroup.js';

import { buildTimetableBoardForDate } from '../utils/timetableBoard.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';
import {
  sanitizeSchedulesByTrainerForPublic,
  sanitizeTrainerForPublic,
  sanitizeSubjectForPublic,
} from '../utils/publicTimetable.js';

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

  let subjectDoc = null;
  if (payload.subject) {
    subjectDoc = await Subject.findById(payload.subject)
      .populate('departments', 'code')
      .populate('schools', 'code');
    if (subjectDoc) {
      payload.subjectCode = subjectDoc.code;
    }
  } else if (payload.subjectCode) {
    subjectDoc = await Subject.findOne({ code: payload.subjectCode })
      .populate('departments', 'code')
      .populate('schools', 'code');
    if (subjectDoc) {
      payload.subject = subjectDoc._id;
    }
  }

  if (payload.classId) {
    const cls = await ClassGroup.findById(payload.classId);
    if (!cls || cls.status !== 'active') {
      const error = new Error('Selected class is not registered or is inactive.');
      error.statusCode = 400;
      throw error;
    }
    payload.department = cls.department;
    payload.section = cls.section;
    payload.semester = cls.currentSemester;
    delete payload.classId;
  } else {
    await assertClassRegistered({
      department: payload.department,
      section: payload.section,
      semester: payload.semester,
    });
  }

  if (subjectDoc) {
    await assertClassAllowedForSubject(subjectDoc, payload.department);
  }

  if (payload.venue === '' || payload.venue === null) {
    payload.venue = null;
  } else if (payload.venue) {
    const venueDoc = await Venue.findById(payload.venue);
    if (!venueDoc || !venueDoc.isActive) {
      const error = new Error('Selected venue is not available.');
      error.statusCode = 400;
      throw error;
    }
  }

  payload.isLab = payload.isLab === true || payload.isLab === 'true';
  payload.isProject = payload.isProject === true || payload.isProject === 'true';

  return payload;
};

export const getPublicTimetable = async (req, res) => {
  const referenceDate = req.query.referenceDate || new Date();
  const semester = req.query.semester;

  const rosterFilter = await mergeRosterFilter({}, { rosterOnly: true });

  const [{ schedulesByTrainer }, trainers, subjects] = await Promise.all([
    buildTimetableBoardForDate({ referenceDate, semester }),
    Trainer.find(rosterFilter)
      .select('name employeeId scheduleTrainerCodes')
      .populate('subjects', 'name code slotCount slotTimings')
      .sort({ employeeId: 1 })
      .limit(200)
      .lean(),
    Subject.find()
      .select('code name slotCount slotTimings semester')
      .populate('semester', 'name number')
      .sort({ code: 1 })
      .limit(100)
      .lean(),
  ]);

  res.json({
    referenceDate,
    schedulesByTrainer: sanitizeSchedulesByTrainerForPublic(schedulesByTrainer),
    trainers: trainers.map(sanitizeTrainerForPublic),
    subjects: subjects.map(sanitizeSubjectForPublic),
  });
};

export const getTimetableBoard = async (req, res) => {
  const referenceDate = req.query.referenceDate || new Date();
  const { schedulesByTrainer } = await buildTimetableBoardForDate({
    referenceDate,
    semester: req.query.semester,
  });

  res.json({
    referenceDate,
    schedulesByTrainer,
  });
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
  const schedules = sortSchedules(
    await Schedule.find(filter).populate('venue', 'name building floor type')
  );
  res.json(schedules);
};

export const getScheduleById = async (req, res) => {
  const schedule = await Schedule.findById(req.params.id).populate('venue', 'name building floor type');
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
  await schedule.populate('venue', 'name building floor type');
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
  await schedule.populate('venue', 'name building floor type');
  res.json(schedule);
};

export const deleteSchedule = async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  await schedule.deleteOne();
  res.json({ message: 'Schedule removed' });
};

export const getBatches = async (req, res) => {
  const filter = { status: 'active' };
  if (req.query.semester) filter.currentSemester = req.query.semester;

  const classes = await ClassGroup.find(filter)
    .sort({ department: 1, section: 1 })
    .lean();

  res.json(
    classes.map((cls) => ({
      _id: cls._id,
      name: `${cls.department} ${cls.section}`,
      department: cls.department,
      section: cls.section,
      py: cls.py,
      currentSemester: cls.currentSemester,
    }))
  );
};
