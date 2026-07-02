import Leave from '../models/Leave.js';
import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const populateLeave = [
  { path: 'trainer', select: 'name employeeId email department' },
  { path: 'approvedBy', select: 'name email' },
];

const getDaysInRange = (startDate, endDate) => {
  const days = [];
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const d = new Date(start);
  while (d <= end) {
    days.push(WEEKDAYS[d.getDay()]);
    d.setDate(d.getDate() + 1);
  }
  return [...new Set(days)];
};

const findAffectedSchedules = async (trainerId, startDate, endDate) => {
  const trainer = await Trainer.findById(trainerId);
  if (!trainer) return [];

  const days = getDaysInRange(startDate, endDate);

  return Schedule.find({
    trainerCode: { $in: resolveTrainerScheduleCodes(trainer) },
    day: { $in: days },
  }).sort({ day: 1, startTime: 1 });
};

export const getLeaves = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.trainer) filter.trainer = req.query.trainer;

  // Trainers only see their own leaves
  if (req.user.role === 'trainer' && req.user.trainer) {
    filter.trainer = req.user.trainer;
  }

  const [leaves, total] = await Promise.all([
    Leave.find(filter).populate(populateLeave).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Leave.countDocuments(filter),
  ]);

  res.json({ leaves, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const getLeaveById = async (req, res) => {
  const leave = await Leave.findById(req.params.id).populate(populateLeave);
  if (!leave) return res.status(404).json({ message: 'Leave not found' });

  if (req.user.role === 'trainer' && leave.trainer._id.toString() !== req.user.trainer?.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  res.json(leave);
};

export const createLeave = async (req, res) => {
  const trainerId = req.user.role === 'trainer' ? req.user.trainer : req.body.trainer;
  if (!trainerId) {
    return res.status(400).json({ message: 'Trainer is required' });
  }

  const startDate = normalizeDate(req.body.startDate);
  const endDate = normalizeDate(req.body.endDate);
  if (endDate < startDate) {
    return res.status(400).json({ message: 'End date must be on or after start date' });
  }

  const affectedSchedules = await findAffectedSchedules(trainerId, startDate, endDate);
  const affectedIds = affectedSchedules.map((s) => s._id);

  const leave = await Leave.create({
    trainer: trainerId,
    startDate,
    endDate,
    reason: req.body.reason,
    affectedSchedules: affectedIds,
    replacementNeeded: affectedIds.length > 0,
  });

  const populated = await Leave.findById(leave._id).populate(populateLeave);
  res.status(201).json(populated);
};

export const updateLeave = async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) return res.status(404).json({ message: 'Leave not found' });

  if (!['admin', 'campus_manager'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only managers can approve or reject leaves' });
  }

  const { status, rejectionReason } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be approved or rejected' });
  }

  leave.status = status;
  leave.approvedBy = req.user._id;
  leave.approvedAt = new Date();
  if (status === 'rejected' && rejectionReason) {
    leave.rejectionReason = rejectionReason;
  }

  await leave.save();
  const updated = await Leave.findById(leave._id).populate(populateLeave);
  res.json(updated);
};

export const deleteLeave = async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) return res.status(404).json({ message: 'Leave not found' });

  if (req.user.role === 'trainer') {
    if (leave.trainer.toString() !== req.user.trainer?.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending leaves can be cancelled' });
    }
  }

  await leave.deleteOne();
  res.json({ message: 'Leave removed' });
};

export const previewAffectedSchedules = async (req, res) => {
  const trainerId = req.query.trainer || req.user.trainer;
  if (!trainerId) {
    return res.status(400).json({ message: 'Trainer is required' });
  }

  if (!req.query.startDate || !req.query.endDate) {
    return res.status(400).json({ message: 'Start date and end date are required' });
  }

  const schedules = await findAffectedSchedules(trainerId, req.query.startDate, req.query.endDate);
  res.json({ schedules, count: schedules.length });
};
