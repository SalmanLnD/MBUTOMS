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
import crypto from 'node:crypto';

import { buildTimetableBoardForDate } from '../utils/timetableBoard.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from '../utils/attendanceTracking.js';
import {
  SPECIAL_CLASS_TYPES,
  getWeekdayForDateKey,
  getWeekdaysBetween,
  isSpecialScheduleInRange,
} from '../utils/specialClass.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';
import { buildLiveTrainerVenues, parseIstClockTime } from '../utils/liveTrainerVenues.js';
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
  specialRange = null,
}) => {
  const query = { trainerCode, day };
  if (excludeId) query._id = { $ne: excludeId };

  const sameDay = await Schedule.find(query);
  return sameDay.find((entry) => {
    if (!timesOverlap(startTime, endTime, entry.startTime, entry.endTime)) return false;
    if (!specialRange) return true;
    return isSpecialScheduleInRange(entry, specialRange.start, specialRange.end);
  });
};

const formatConflictMessage = (conflict) => {
  const subjectPart = conflict.subjectCode ? ` (${conflict.subjectCode})` : '';
  const specialPart = conflict.isSpecial ? ' special class' : '';
  return `Trainer already has ${conflict.department} ${conflict.section}${subjectPart}${specialPart} on ${conflict.day} from ${conflict.startTime} to ${conflict.endTime}. A trainer cannot be in two places at the same time.`;
};

const getSpecialRangeForSchedule = (schedule) => (
  schedule?.isSpecial && schedule.specialStartDate
    ? { start: schedule.specialStartDate, end: schedule.specialEndDate || schedule.specialStartDate }
    : null
);

const enrichSchedulePayload = async (body, { allowAnySubjectClass = false } = {}) => {
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

  if (subjectDoc && !allowAnySubjectClass) {
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

export const getLiveTrainerVenues = async (req, res) => {
  const time = String(req.query.time || '').trim();
  if (time && !parseIstClockTime(time)) {
    return res.status(400).json({ message: 'Enter a valid time as HH:mm.' });
  }
  const payload = await buildLiveTrainerVenues({
    now: new Date(),
    time: time || undefined,
  });
  res.json(payload);
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
    await Schedule.find(filter)
      .select('trainerCode day startTime endTime department section subjectCode subject slot semester venue isLab isProject isSpecial specialType specialStartDate specialEndDate specialGroupId specialReason')
      .populate('venue', 'name building floor type')
      .lean()
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
  clearAttendanceGridCache();
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
    specialRange: getSpecialRangeForSchedule(schedule),
  });
  if (conflict) {
    return res.status(409).json({ message: formatConflictMessage(conflict) });
  }

  Object.assign(schedule, payload);
  await schedule.save();
  await schedule.populate('venue', 'name building floor type');
  clearAttendanceGridCache();
  res.json(schedule);
};

export const deleteSchedule = async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  await schedule.deleteOne();
  clearAttendanceGridCache();
  res.json({ message: 'Schedule removed' });
};

const MAX_SPECIAL_RANGE_DAYS = 366;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

const resolveSpecialDates = (body) => {
  const type = body.specialType;
  if (!Object.values(SPECIAL_CLASS_TYPES).includes(type)) {
    throw badRequest('Choose one-time or recurring special class.');
  }

  if (type === SPECIAL_CLASS_TYPES.ONE_TIME) {
    const dateKey = toAttendanceDateKey(body.date);
    if (!dateKey) throw badRequest('Select a valid date for the special class.');
    return { type, startKey: dateKey, endKey: dateKey, days: [getWeekdayForDateKey(dateKey)] };
  }

  const startKey = toAttendanceDateKey(body.startDate);
  const endKey = toAttendanceDateKey(body.endDate);
  if (!startKey || !endKey) throw badRequest('Select a valid start and end date.');
  if (endKey < startKey) throw badRequest('End date must be on or after the start date.');

  const spanDays = Math.round(
    (normalizeAttendanceDate(endKey) - normalizeAttendanceDate(startKey)) / 86_400_000
  ) + 1;
  if (spanDays > MAX_SPECIAL_RANGE_DAYS) {
    throw badRequest('Recurring special classes can span at most one year.');
  }

  const available = new Set(getWeekdaysBetween(startKey, endKey));
  const requested = [...new Set((Array.isArray(body.days) ? body.days : []).map(String))];
  if (!requested.length) throw badRequest('Select at least one weekday for the recurring class.');
  const missing = requested.filter((day) => !available.has(day));
  if (missing.length) {
    throw badRequest(`${missing.join(', ')} does not fall between the selected dates.`);
  }

  return { type, startKey, endKey, days: requested };
};

export const createSpecialClass = async (req, res) => {
  let dates;
  try {
    dates = resolveSpecialDates(req.body);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message });
  }

  const trainerCode = String(req.body.trainerCode || '').trim();
  if (!trainerCode) return res.status(400).json({ message: 'Select a trainer.' });
  const trainer = await Trainer.findOne({
    $or: [{ employeeId: trainerCode }, { scheduleTrainerCodes: trainerCode }],
  }).select('_id');
  if (!trainer) return res.status(400).json({ message: 'Selected trainer was not found.' });

  const startTime = String(req.body.startTime || '').trim();
  const endTime = String(req.body.endTime || '').trim();
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return res.status(400).json({ message: 'Enter valid start and end times.' });
  }
  if (!req.body.classId) return res.status(400).json({ message: 'Select a class.' });
  if (!req.body.subject) return res.status(400).json({ message: 'Select a subject.' });

  let base;
  try {
    base = await enrichSchedulePayload({
      trainerCode,
      startTime,
      endTime,
      classId: req.body.classId,
      subject: req.body.subject,
      slot: ['S1', 'S2', 'S3', 'S4'].includes(req.body.slot) ? req.body.slot : '',
      venue: req.body.venue || null,
      isLab: req.body.isLab,
      isProject: req.body.isProject,
    }, { allowAnySubjectClass: true });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message });
  }
  if (!base.subjectCode) {
    return res.status(400).json({ message: 'Selected subject was not found.' });
  }

  const specialStartDate = normalizeAttendanceDate(dates.startKey);
  const specialEndDate = normalizeAttendanceDate(dates.endKey);
  const specialRange = { start: specialStartDate, end: specialEndDate };

  for (const day of dates.days) {
    const conflict = await findTrainerTimeConflict({
      trainerCode,
      day,
      startTime,
      endTime,
      specialRange,
    });
    if (conflict) {
      return res.status(409).json({ message: formatConflictMessage(conflict) });
    }
  }

  const specialGroupId = crypto.randomUUID();
  const specialReason = String(req.body.reason || '').trim().slice(0, 200);
  const includeInRtet = req.body.includeInRtet !== false && req.body.includeInRtet !== 'false';
  const created = await Schedule.insertMany(
    dates.days.map((day) => ({
      ...base,
      day,
      isSpecial: true,
      specialType: dates.type,
      specialStartDate,
      specialEndDate,
      specialGroupId,
      specialReason,
      includeInRtet,
    }))
  );

  clearAttendanceGridCache();
  res.status(201).json({
    specialGroupId,
    count: created.length,
    schedules: created,
  });
};

export const getSpecialClasses = async (req, res) => {
  const filter = { isSpecial: true };
  const fromKey = toAttendanceDateKey(req.query.from);
  if (fromKey) filter.specialEndDate = { $gte: normalizeAttendanceDate(fromKey) };

  const schedules = await Schedule.find(filter)
    .select('trainerCode day startTime endTime department section semester subjectCode slot specialType specialStartDate specialEndDate specialGroupId specialReason includeInRtet')
    .sort({ specialStartDate: 1, startTime: 1 })
    .limit(500)
    .lean();

  const trainerCodes = [...new Set(schedules.map((schedule) => schedule.trainerCode))];
  const trainers = await Trainer.find({
    $or: [{ employeeId: { $in: trainerCodes } }, { scheduleTrainerCodes: { $in: trainerCodes } }],
  })
    .select('name employeeId scheduleTrainerCodes')
    .lean();
  const nameByCode = new Map();
  trainers.forEach((trainer) => {
    [trainer.employeeId, ...(trainer.scheduleTrainerCodes || [])].forEach((code) => {
      if (code && !nameByCode.has(code)) nameByCode.set(code, trainer.name);
    });
  });

  const groups = new Map();
  schedules.forEach((schedule) => {
    const key = schedule.specialGroupId || schedule._id.toString();
    if (!groups.has(key)) {
      groups.set(key, {
        specialGroupId: key,
        specialType: schedule.specialType,
        trainerCode: schedule.trainerCode,
        trainerName: nameByCode.get(schedule.trainerCode) || schedule.trainerCode,
        department: schedule.department,
        section: schedule.section,
        semester: schedule.semester,
        subjectCode: schedule.subjectCode,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        startDate: toAttendanceDateKey(schedule.specialStartDate),
        endDate: toAttendanceDateKey(schedule.specialEndDate),
        reason: schedule.specialReason || '',
        includeInRtet: schedule.includeInRtet !== false,
        days: [],
        scheduleIds: [],
      });
    }
    const group = groups.get(key);
    group.days.push(schedule.day);
    group.scheduleIds.push(schedule._id);
  });

  res.json({ specialClasses: [...groups.values()] });
};

export const deleteSpecialClass = async (req, res) => {
  const groupId = String(req.params.groupId || '').trim();
  const filter = /^[a-f\d]{24}$/i.test(groupId)
    ? { isSpecial: true, $or: [{ specialGroupId: groupId }, { _id: groupId }] }
    : { isSpecial: true, specialGroupId: groupId };

  const result = await Schedule.deleteMany(filter);
  if (!result.deletedCount) {
    return res.status(404).json({ message: 'Special class not found' });
  }
  clearAttendanceGridCache();
  res.json({ message: 'Special class removed', count: result.deletedCount });
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
