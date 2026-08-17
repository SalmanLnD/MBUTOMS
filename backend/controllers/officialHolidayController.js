import OfficialHoliday from '../models/OfficialHoliday.js';
import {
  normalizeAttendanceDate,
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from '../utils/attendanceDates.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';
import {
  markRosterOfficialHoliday,
  unmarkRosterOfficialHoliday,
} from '../utils/officialHolidays.js';

export const listOfficialHolidays = async (req, res) => {
  const filter = {};
  if (req.query.from) {
    filter.date = { ...filter.date, $gte: normalizeAttendanceDate(req.query.from) };
  }
  if (req.query.to) {
    filter.date = { ...filter.date, $lte: normalizeAttendanceDate(req.query.to) };
  }
  if (!filter.date) {
    filter.date = { $gte: TRAINER_ATTENDANCE_TRACKING_START };
  }

  const holidays = await OfficialHoliday.find(filter)
    .sort({ date: 1 })
    .lean();

  res.json({
    holidays: holidays.map((holiday) => ({
      id: holiday._id,
      date: toAttendanceDateKey(holiday.date),
      name: holiday.name || 'Official leave',
    })),
  });
};

export const createOfficialHoliday = async (req, res) => {
  const { date, name } = req.body || {};
  if (!date) {
    return res.status(400).json({ message: 'Date is required' });
  }

  const day = normalizeAttendanceDate(date);
  if (Number.isNaN(day.getTime())) {
    return res.status(400).json({ message: 'Enter a valid date' });
  }
  if (day < TRAINER_ATTENDANCE_TRACKING_START) {
    return res.status(400).json({ message: 'Holidays start from 1 July 2026.' });
  }

  const label = String(name || 'Official leave').trim().slice(0, 80) || 'Official leave';
  try {
    const holiday = await OfficialHoliday.create({
      date: day,
      name: label,
      createdBy: req.user._id,
    });
    await markRosterOfficialHoliday(day);
    clearAttendanceGridCache();
    res.status(201).json({
      id: holiday._id,
      date: toAttendanceDateKey(holiday.date),
      name: holiday.name,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'A holiday is already set for this date.' });
    }
    throw error;
  }
};

export const deleteOfficialHoliday = async (req, res) => {
  const holiday = await OfficialHoliday.findById(req.params.id);
  if (!holiday) {
    return res.status(404).json({ message: 'Holiday not found' });
  }

  await unmarkRosterOfficialHoliday(holiday.date);
  await holiday.deleteOne();
  clearAttendanceGridCache();
  res.json({ message: 'Holiday removed' });
};
