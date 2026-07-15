import ClassCancellation from '../models/ClassCancellation.js';
import Department from '../models/Department.js';
import Schedule from '../models/Schedule.js';
import School from '../models/School.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';
import {
  excludeCanceledSchedules,
  getCanceledScheduleIdsForDate,
} from '../utils/classCancellations.js';
import {
  normalizeAttendanceDate,
  toAttendanceDateKey,
} from '../utils/attendanceTracking.js';
import { getAttendanceWeekdayName } from '../utils/attendanceDates.js';
import { filterSchedulesActiveOnDate } from '../utils/activeSchedulesForDate.js';
import { expandAllowedClassDepartments } from '../utils/subjectClassEligibility.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SCOPES = new Set(['classes', 'school', 'all']);

const parseDate = (value) => {
  const raw = String(value || '');
  if (!DATE_PATTERN.test(raw)) {
    const error = new Error('Enter a valid cancellation date.');
    error.statusCode = 400;
    throw error;
  }
  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    const error = new Error('Enter a valid cancellation date.');
    error.statusCode = 400;
    throw error;
  }
  return normalizeAttendanceDate(raw);
};

const getSchedulesForDate = async (date) => {
  const day = getAttendanceWeekdayName(date);
  const schedules = await Schedule.find({ day })
    .populate('venue', 'name building floor type')
    .sort({ startTime: 1, department: 1, section: 1 })
    .lean();
  return filterSchedulesActiveOnDate(schedules, date);
};

const populateCancellation = (query) =>
  query
    .populate('school', 'name code')
    .populate('createdBy', 'name email')
    .populate({
      path: 'schedules',
      select: 'trainerCode day startTime endTime department section subjectCode slot semester venue',
      populate: { path: 'venue', select: 'name building floor type' },
    });

export const getClassCancellationOptions = async (req, res) => {
  const date = parseDate(req.query.date);
  const [schedules, canceledIds, cancellations, schools] = await Promise.all([
    getSchedulesForDate(date),
    getCanceledScheduleIdsForDate(date),
    populateCancellation(
      ClassCancellation.find({ date }).sort({ createdAt: -1 })
    ).lean(),
    School.find().sort({ code: 1 }).lean(),
  ]);

  res.json({
    date: toAttendanceDateKey(date),
    day: getAttendanceWeekdayName(date),
    schedules: schedules.map((schedule) => ({
      ...schedule,
      isCanceled: canceledIds.has(schedule._id.toString()),
    })),
    schools,
    cancellations,
  });
};

export const createClassCancellation = async (req, res) => {
  const date = parseDate(req.body.date);
  const scope = String(req.body.scope || '');
  const reason = String(req.body.reason || '').trim();

  if (!VALID_SCOPES.has(scope)) {
    return res.status(400).json({ message: 'Select a valid cancellation scope.' });
  }
  if (reason.length > 300) {
    return res.status(400).json({ message: 'Reason must be 300 characters or fewer.' });
  }

  const schedules = await getSchedulesForDate(date);
  let selectedSchedules = [];
  let school = null;

  if (scope === 'classes') {
    const requestedIds = new Set(
      (Array.isArray(req.body.scheduleIds) ? req.body.scheduleIds : [])
        .map((value) => String(value))
    );
    selectedSchedules = schedules.filter((schedule) =>
      requestedIds.has(schedule._id.toString())
    );
    if (!selectedSchedules.length || selectedSchedules.length !== requestedIds.size) {
      return res.status(400).json({
        message: 'Select one or more valid classes scheduled on this date.',
      });
    }
  } else if (scope === 'school') {
    school = await School.findById(req.body.schoolId).lean();
    if (!school) {
      return res.status(400).json({ message: 'Select a valid school.' });
    }
    const departments = await Department.find({ school: school._id })
      .select('code')
      .lean();
    const classDepartments = new Set(
      expandAllowedClassDepartments(departments.map((department) => department.code))
    );
    selectedSchedules = schedules.filter((schedule) =>
      classDepartments.has(schedule.department)
    );
    if (!selectedSchedules.length) {
      return res.status(400).json({
        message: `No classes are scheduled for ${school.name} on this date.`,
      });
    }
  } else {
    selectedSchedules = schedules;
    if (!selectedSchedules.length) {
      return res.status(400).json({ message: 'No classes are scheduled on this date.' });
    }
  }

  const canceledIds = await getCanceledScheduleIdsForDate(date);
  const newSchedules = excludeCanceledSchedules(selectedSchedules, canceledIds);
  if (!newSchedules.length) {
    return res.status(409).json({
      message: 'All selected classes are already canceled for this date.',
    });
  }

  const cancellation = await ClassCancellation.create({
    date,
    scope,
    schedules: newSchedules.map((schedule) => schedule._id),
    school: school?._id || null,
    reason,
    createdBy: req.user._id,
  });

  clearAttendanceGridCache();
  const populated = await populateCancellation(
    ClassCancellation.findById(cancellation._id)
  ).lean();

  res.status(201).json(populated);
};

export const deleteClassCancellation = async (req, res) => {
  const cancellation = await ClassCancellation.findById(req.params.id);
  if (!cancellation) {
    return res.status(404).json({ message: 'Class cancellation not found.' });
  }

  await cancellation.deleteOne();
  clearAttendanceGridCache();
  res.json({ message: 'Class cancellation removed.' });
};
