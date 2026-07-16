import Leave from '../models/Leave.js';
import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';
import {
  FULL_ACCESS_ROLES,
  canCreateLeaveForOthers,
  isTrainerLikeRole,
} from '../utils/roles.js';
import { notifyReplacementCancellation } from '../utils/replacementNotifications.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';
import { LEAVE_SCOPES } from '../utils/leaveScope.js';
import {
  buildAffectedClassOccurrences,
  getCancellationMapForRange,
  getEffectiveAffectedSchedules,
} from '../utils/leaveAffectedClasses.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const isOwnLeave = (leave, user) =>
  leave.trainer._id.toString() === user.trainer?.toString();

const hasExactFullAccess = (role) => FULL_ACCESS_ROLES.includes(role);

const populateLeave = [
  { path: 'trainer', select: 'name employeeId email department' },
  { path: 'approvedBy', select: 'name email' },
  {
    path: 'affectedSchedules',
    select: 'trainerCode day startTime endTime department section subjectCode slot semester',
  },
];

const addEffectiveAffectedData = (leave, cancellationMap) => {
  const plain = leave.toObject ? leave.toObject() : { ...leave };
  const occurrences = buildAffectedClassOccurrences(
    plain,
    plain.affectedSchedules,
    cancellationMap
  );
  const effectiveSchedules = getEffectiveAffectedSchedules(
    plain,
    plain.affectedSchedules,
    cancellationMap
  );
  return {
    ...plain,
    affectedClassCount: occurrences.length,
    replacementNeeded:
      plain.status !== 'rejected'
      && plain.status !== 'cancelled'
      && effectiveSchedules.length > 0,
  };
};

const addEffectiveAffectedDataToLeaves = async (leaves) => {
  if (!leaves.length) return [];
  const startDate = leaves.reduce(
    (earliest, leave) => (leave.startDate < earliest ? leave.startDate : earliest),
    leaves[0].startDate
  );
  const endDate = leaves.reduce(
    (latest, leave) => (leave.endDate > latest ? leave.endDate : latest),
    leaves[0].endDate
  );
  const cancellationMap = await getCancellationMapForRange(startDate, endDate);
  return leaves.map((leave) => addEffectiveAffectedData(leave, cancellationMap));
};

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

  // Trainers and subject coordinators only see their own leaves
  if (isTrainerLikeRole(req.user.role) && req.user.trainer) {
    filter.trainer = req.user.trainer;
  }

  const [leaveDocs, total] = await Promise.all([
    Leave.find(filter).populate(populateLeave).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Leave.countDocuments(filter),
  ]);
  const leaves = await addEffectiveAffectedDataToLeaves(leaveDocs);

  res.json({ leaves, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const getLeaveById = async (req, res) => {
  const leave = await Leave.findById(req.params.id).populate(populateLeave);
  if (!leave) return res.status(404).json({ message: 'Leave not found' });

  if (isTrainerLikeRole(req.user.role) && !isOwnLeave(leave, req.user)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const cancellationMap = await getCancellationMapForRange(leave.startDate, leave.endDate);
  res.json(addEffectiveAffectedData(leave, cancellationMap));
};

export const createLeave = async (req, res) => {
  let trainerId;
  if (isTrainerLikeRole(req.user.role)) {
    trainerId = req.user.trainer;
    if (!trainerId) {
      return res.status(400).json({ message: 'Your account is not linked to a trainer profile' });
    }
  } else if (canCreateLeaveForOthers(req.user.role)) {
    trainerId = req.body.trainer;
    if (!trainerId) {
      return res.status(400).json({ message: 'Trainer is required' });
    }
  } else {
    return res.status(403).json({
      message: 'Only admins can apply leave on behalf of other trainers',
    });
  }

  const startDate = normalizeDate(req.body.startDate);
  const endDate = normalizeDate(req.body.endDate);
  if (endDate < startDate) {
    return res.status(400).json({ message: 'End date must be on or after start date' });
  }

  const affectedSchedules = await findAffectedSchedules(trainerId, startDate, endDate);
  const affectedIds = affectedSchedules.map((s) => s._id);
  const cancellationMap = await getCancellationMapForRange(startDate, endDate);
  const effectiveSchedules = getEffectiveAffectedSchedules(
    { startDate, endDate },
    affectedSchedules,
    cancellationMap
  );

  const leave = await Leave.create({
    trainer: trainerId,
    startDate,
    endDate,
    reason: req.body.reason,
    scope: LEAVE_SCOPES.FULL_DAY,
    affectedSchedules: affectedIds,
    replacementNeeded: effectiveSchedules.length > 0,
  });

  const populated = await Leave.findById(leave._id).populate(populateLeave);
  res.status(201).json(addEffectiveAffectedData(populated, cancellationMap));
};

export const updateLeave = async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) return res.status(404).json({ message: 'Leave not found' });

  if (!hasExactFullAccess(req.user.role)) {
    return res.status(403).json({ message: 'Only managers can approve or reject leaves' });
  }

  if (leave.status === 'cancelled') {
    return res.status(400).json({ message: 'Cancelled leaves cannot be updated' });
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
  clearAttendanceGridCache();
  const updated = await Leave.findById(leave._id).populate(populateLeave);
  const cancellationMap = await getCancellationMapForRange(
    updated.startDate,
    updated.endDate
  );
  res.json(addEffectiveAffectedData(updated, cancellationMap));
};

export const deleteLeave = async (req, res) => {
  const leave = await Leave.findById(req.params.id)
    .populate('trainer', 'name employeeId')
    .populate('affectedSchedules')
    .populate({
      path: 'replacements.schedule',
      select: 'department section startTime endTime day',
    })
    .populate({
      path: 'replacements.replacementTrainer',
      select: 'name employeeId',
    });

  if (!leave) return res.status(404).json({ message: 'Leave not found' });

  if (['rejected', 'cancelled'].includes(leave.status)) {
    return res.status(400).json({ message: 'This leave cannot be cancelled' });
  }

  if (isTrainerLikeRole(req.user.role)) {
    if (!isOwnLeave(leave, req.user)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
  } else if (!hasExactFullAccess(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const hadReplacements = Array.isArray(leave.replacements) && leave.replacements.length > 0;
  const revokedReplacements = hadReplacements ? [...leave.replacements] : [];

  leave.replacements = [];
  leave.replacementNeeded = false;
  leave.status = 'cancelled';
  leave.markModified('replacements');
  await leave.save();
  clearAttendanceGridCache();

  if (hadReplacements) {
    try {
      await notifyReplacementCancellation({
        actor: req.user,
        leave,
        originalTrainer: leave.trainer,
        replacements: revokedReplacements,
      });
    } catch (error) {
      console.error('Failed to send replacement cancellation notifications:', error.message);
    }
  }

  const updated = await Leave.findById(leave._id).populate(populateLeave);
  res.json({
    message: hadReplacements
      ? 'Leave cancelled and replacement assignments revoked'
      : 'Leave cancelled',
    leave: updated,
  });
};

export const previewAffectedSchedules = async (req, res) => {
  let trainerId;
  if (isTrainerLikeRole(req.user.role)) {
    trainerId = req.user.trainer;
  } else if (canCreateLeaveForOthers(req.user.role)) {
    trainerId = req.query.trainer || req.user.trainer;
  } else {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (!trainerId) {
    return res.status(400).json({ message: 'Trainer is required' });
  }

  if (!req.query.startDate || !req.query.endDate) {
    return res.status(400).json({ message: 'Start date and end date are required' });
  }

  const schedules = await findAffectedSchedules(trainerId, req.query.startDate, req.query.endDate);
  const leaveRange = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };
  const cancellationMap = await getCancellationMapForRange(
    req.query.startDate,
    req.query.endDate
  );
  const occurrences = buildAffectedClassOccurrences(
    leaveRange,
    schedules,
    cancellationMap
  );
  res.json({
    schedules: occurrences.map(({ schedule, date }) => ({
      ...(schedule.toObject ? schedule.toObject() : schedule),
      date,
    })),
    count: occurrences.length,
  });
};
