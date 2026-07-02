import Attendance from '../models/Attendance.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';

const populateOptions = [
  { path: 'trainer', select: 'name employeeId' },
  { path: 'student', select: 'name rollNumber' },
  { path: 'schedule', populate: [
    { path: 'subject', select: 'name code' },
    { path: 'venue', select: 'name' },
  ]},
  { path: 'markedBy', select: 'name' },
];

export const getAttendance = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.trainer) filter.trainer = req.query.trainer;
  if (req.query.student) filter.student = req.query.student;
  if (req.query.date) {
    const day = normalizeDate(req.query.date);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    filter.date = { $gte: day, $lt: next };
  }

  const [records, total] = await Promise.all([
    Attendance.find(filter).populate(populateOptions).sort({ date: -1 }).skip(skip).limit(limit),
    Attendance.countDocuments(filter),
  ]);

  res.json({ records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const markAttendance = async (req, res) => {
  const { type, trainer, student, schedule, date, status, remarks } = req.body;

  const record = await Attendance.create({
    type,
    trainer: type === 'trainer' ? trainer : undefined,
    student: type === 'student' ? student : undefined,
    schedule,
    date: normalizeDate(date),
    status,
    remarks,
    markedBy: req.user._id,
  });

  const populated = await Attendance.findById(record._id).populate(populateOptions);
  res.status(201).json(populated);
};

export const updateAttendance = async (req, res) => {
  const record = await Attendance.findById(req.params.id);
  if (!record) return res.status(404).json({ message: 'Attendance record not found' });

  Object.assign(record, req.body);
  if (req.body.date) record.date = normalizeDate(req.body.date);
  await record.save();

  const updated = await Attendance.findById(record._id).populate(populateOptions);
  res.json(updated);
};

export const getAttendanceSummary = async (req, res) => {
  const filter = {};
  if (req.query.date) {
    const day = normalizeDate(req.query.date);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    filter.date = { $gte: day, $lt: next };
  }
  if (req.query.type) filter.type = req.query.type;

  const summary = await Attendance.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const result = { present: 0, absent: 0, late: 0, leave: 0, od: 0, holiday: 0 };
  summary.forEach((s) => { result[s._id] = s.count; });

  res.json(result);
};
