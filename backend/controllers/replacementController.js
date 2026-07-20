import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';
import { isTrainerAvailableForReplacement } from '../utils/leaveStatus.js';
import { buildTrainerAvailabilityForRange } from '../utils/trainerAvailability.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';
import { notifyReplacementAssignment } from '../utils/replacementNotifications.js';
import { LEAVE_SCOPES } from '../utils/leaveScope.js';
import {
  getCancellationMapForRange,
  getUncancelledScheduleDateKeys,
} from '../utils/leaveAffectedClasses.js';
import { toLeaveDateKey } from '../utils/leaveDateRange.js';
import { getCanceledScheduleIdsForDate } from '../utils/classCancellations.js';

const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const timesOverlap = (startA, endA, startB, endB) =>
  parseTimeToMinutes(startA) < parseTimeToMinutes(endB) &&
  parseTimeToMinutes(endA) > parseTimeToMinutes(startB);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getScheduleId = (value) => value?._id?.toString() || value?.toString();

const resolveReplacementTrainer = (leave, schedule, trainersById) => {
  const scheduleId = schedule._id.toString();
  const record = leave.replacements?.find(
    (entry) => getScheduleId(entry.schedule) === scheduleId
  );

  if (!record) return null;

  if (record.isExternal && record.externalTrainerName) {
    return {
      _id: null,
      name: record.externalTrainerName,
      employeeId: null,
      isExternal: true,
    };
  }

  if (!record.replacementTrainer) return null;

  if (typeof record.replacementTrainer === 'object' && record.replacementTrainer.name) {
    return {
      ...record.replacementTrainer,
      isExternal: false,
    };
  }

  const trainerId = record.replacementTrainer.toString();
  const trainer = trainersById.get(trainerId);
  return trainer ? { ...trainer, isExternal: false } : null;
};

export const getReplacementSuggestions = async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

  const leaveFilter = {
    affectedSchedules: schedule._id,
    status: 'approved',
  };
  if (req.query.leaveId) leaveFilter._id = req.query.leaveId;
  const leave = await Leave.findOne(leaveFilter);
  if (!leave) {
    return res.status(400).json({ message: 'No approved leave found for this schedule' });
  }
  const cancellationMap = await getCancellationMapForRange(
    leave.startDate,
    leave.endDate
  );
  const affectedDateKeys = getUncancelledScheduleDateKeys(
    leave,
    schedule,
    cancellationMap
  );
  if (!affectedDateKeys.length) {
    return res.status(400).json({
      message: 'This class is canceled for the leave date, so no replacement is needed.',
    });
  }

  let subject = null;
  if (schedule.subject) {
    subject = await Subject.findById(schedule.subject).select('trainerEligible name code');
  } else if (schedule.subjectCode) {
    subject = await Subject.findOne({ code: schedule.subjectCode }).select('trainerEligible name code');
  }

  const eligibleTrainerIds = new Set(
    (subject?.trainerEligible || []).map((trainerId) => trainerId.toString())
  );

  const trainers = await Trainer.find({
    _id: { $ne: leave.trainer },
    status: 'active',
  })
    .select('name employeeId email performanceScore status scheduleTrainerCodes')
    .lean();

  // Batch everything the per-trainer loop needs into two queries instead of
  // ~3 queries per trainer (leave check + day conflicts + weekly hours).
  const leaveStart = normalizeDate(leave.startDate);
  const leaveEnd = normalizeDate(leave.endDate);
  const scheduleDayDates = affectedDateKeys.map((dateKey) => normalizeDate(dateKey));

  const codesByTrainer = new Map(
    trainers.map((trainer) => [trainer._id.toString(), resolveTrainerScheduleCodes(trainer)])
  );
  const allCodes = [...new Set([...codesByTrainer.values()].flat())];

  const [overlappingLeaves, allSchedules] = await Promise.all([
    scheduleDayDates.length
      ? Leave.find({
          status: 'approved',
          trainer: { $in: trainers.map((trainer) => trainer._id) },
          startDate: { $lte: leaveEnd },
          endDate: { $gte: leaveStart },
        })
          .select('trainer startDate endDate')
          .lean()
      : [],
    Schedule.find({ trainerCode: { $in: allCodes } })
      .select('trainerCode day startTime endTime')
      .lean(),
  ]);

  const leavesByTrainer = new Map();
  for (const activeLeave of overlappingLeaves) {
    const key = activeLeave.trainer.toString();
    if (!leavesByTrainer.has(key)) leavesByTrainer.set(key, []);
    leavesByTrainer.get(key).push(activeLeave);
  }

  const schedulesByCode = new Map();
  for (const slot of allSchedules) {
    if (!schedulesByCode.has(slot.trainerCode)) schedulesByCode.set(slot.trainerCode, []);
    schedulesByCode.get(slot.trainerCode).push(slot);
  }

  const isOnLeaveForScheduleDay = (trainerId) => {
    const trainerLeaves = leavesByTrainer.get(trainerId) || [];
    if (!trainerLeaves.length) return false;
    return scheduleDayDates.some((day) =>
      trainerLeaves.some(
        (entry) => normalizeDate(entry.startDate) <= day && normalizeDate(entry.endDate) >= day
      )
    );
  };

  const eligibleSuggestions = [];
  const otherSuggestions = [];

  for (const trainer of trainers) {
    if (isOnLeaveForScheduleDay(trainer._id.toString())) continue;

    const scheduleCodes = codesByTrainer.get(trainer._id.toString()) || [];
    const trainerSchedules = scheduleCodes.flatMap((code) => schedulesByCode.get(code) || []);

    const hasConflict = scheduleDayDates.some((date) => {
      const dateKey = toLeaveDateKey(date);
      return trainerSchedules.some(
        (s) =>
          s.day === schedule.day
          && !cancellationMap.get(dateKey)?.has(s._id.toString())
          && timesOverlap(schedule.startTime, schedule.endTime, s.startTime, s.endTime)
      );
    });
    if (hasConflict) continue;

    const weeklyHours = trainerSchedules.reduce((sum, s) => {
      const diff = parseTimeToMinutes(s.endTime) - parseTimeToMinutes(s.startTime);
      return sum + diff / 60;
    }, 0);

    const suggestion = {
      trainer: {
        _id: trainer._id,
        name: trainer.name,
        employeeId: trainer.employeeId,
        email: trainer.email,
        performanceScore: trainer.performanceScore,
        weeklyWorkloadHours: weeklyHours,
      },
      weeklyHours,
      performanceScore: trainer.performanceScore,
      eligible: eligibleTrainerIds.has(trainer._id.toString()),
    };

    if (suggestion.eligible) {
      eligibleSuggestions.push(suggestion);
    } else {
      otherSuggestions.push(suggestion);
    }
  }

  const sortSuggestions = (a, b) => {
    if (a.weeklyHours !== b.weeklyHours) return a.weeklyHours - b.weeklyHours;
    return b.performanceScore - a.performanceScore;
  };

  eligibleSuggestions.sort(sortSuggestions);
  otherSuggestions.sort(sortSuggestions);

  res.json({
    schedule,
    subject: subject ? { name: subject.name, code: subject.code } : null,
    suggestions: eligibleSuggestions,
    otherSuggestions,
    affectedDates: affectedDateKeys,
  });
};

export const getAllReplacements = async (req, res) => {
  const today = normalizeDate(new Date());
  const leaves = await Leave.find({
    affectedSchedules: { $exists: true, $not: { $size: 0 } },
  })
    .populate('trainer', 'name employeeId')
    .populate({
      path: 'affectedSchedules',
      populate: [
        { path: 'subject', select: 'name code' },
        { path: 'venue', select: 'name building floor' },
      ],
    })
    .populate({
      path: 'replacements.replacementTrainer',
      select: 'name employeeId',
    })
    .sort({ startDate: -1, createdAt: -1 })
    .lean();

  const replacements = [];
  const cancellationMap = leaves.length
    ? await getCancellationMapForRange(
      leaves.reduce(
        (earliest, leave) => (leave.startDate < earliest ? leave.startDate : earliest),
        leaves[0].startDate
      ),
      leaves.reduce(
        (latest, leave) => (leave.endDate > latest ? leave.endDate : latest),
        leaves[0].endDate
      )
    )
    : new Map();
  const todayKey = toLeaveDateKey(today);
  for (const leave of leaves) {
    const startDate = normalizeDate(leave.startDate);
    const endDate = normalizeDate(leave.endDate);
    let timelineStatus = 'upcoming';
    if (leave.status === 'pending') timelineStatus = 'pending_approval';
    else if (leave.status === 'rejected') timelineStatus = 'rejected';
    else if (leave.status === 'cancelled') timelineStatus = 'cancelled';
    else if (endDate < today) timelineStatus = 'previous';
    else if (startDate <= today && endDate >= today) timelineStatus = 'current';

    for (const schedule of leave.affectedSchedules) {
      if (!schedule) continue;
      const affectedDates = getUncancelledScheduleDateKeys(
        leave,
        schedule,
        cancellationMap
      );
      if (!affectedDates.length) continue;
      const replacement = resolveReplacementTrainer(leave, schedule, new Map());
      replacements.push({
        leave: {
          _id: leave._id,
          trainer: leave.trainer,
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: leave.reason,
          status: leave.status,
          replacementNeeded: leave.replacementNeeded,
        },
        schedule,
        replacement,
        timelineStatus,
        canAssign:
          leave.status === 'approved'
          && affectedDates.some((dateKey) => dateKey >= todayKey),
        replacementDate: affectedDates[0],
        affectedDates,
        isSlotReplacement:
          normalizeDate(leave.startDate).getTime() === normalizeDate(leave.endDate).getTime(),
      });
    }
  }

  const rank = {
    current: 0,
    upcoming: 1,
    pending_approval: 2,
    previous: 3,
    rejected: 4,
    cancelled: 5,
  };
  replacements.sort((a, b) => {
    const rankDiff = (rank[a.timelineStatus] ?? 9) - (rank[b.timelineStatus] ?? 9);
    if (rankDiff) return rankDiff;
    return new Date(b.leave.startDate) - new Date(a.leave.startDate);
  });

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const total = replacements.length;
  const paged = replacements.slice((page - 1) * limit, page * limit);

  res.json({
    replacements: paged,
    count: total,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  });
};

export const assignReplacement = async (req, res) => {
  const {
    leaveId,
    scheduleId,
    replacementTrainerId,
    isExternal = false,
    externalTrainerName = '',
  } = req.body;

  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

  const useExternal = Boolean(isExternal);
  const externalName = String(externalTrainerName || '').trim();

  if (useExternal) {
    if (!externalName) {
      return res.status(400).json({ message: 'External trainer name is required' });
    }
  } else if (!replacementTrainerId) {
    return res.status(400).json({ message: 'Replacement trainer is required' });
  }

  let trainer = null;
  if (!useExternal) {
    trainer = await Trainer.findById(replacementTrainerId);
    if (!trainer || trainer.status !== 'active') {
      return res.status(400).json({ message: 'Replacement trainer is not available' });
    }
  }

  const leaveFilter = {
    affectedSchedules: scheduleId,
    status: 'approved',
  };
  if (leaveId) leaveFilter._id = leaveId;
  const leave = await Leave.findOne(leaveFilter).populate('trainer', 'name employeeId');
  if (!leave) {
    return res.status(400).json({ message: 'No approved leave found for this schedule' });
  }
  const cancellationMap = await getCancellationMapForRange(
    leave.startDate,
    leave.endDate
  );
  const affectedDateKeys = getUncancelledScheduleDateKeys(
    leave,
    schedule,
    cancellationMap
  );
  if (!affectedDateKeys.length) {
    return res.status(400).json({
      message: 'This class is canceled for the leave date, so no replacement is needed.',
    });
  }
  if (normalizeDate(leave.endDate) < normalizeDate(new Date())) {
    return res.status(400).json({ message: 'Previous replacement records cannot be changed' });
  }
  if (!useExternal && leave.trainer?._id?.toString() === trainer._id.toString()) {
    return res.status(400).json({ message: 'The original trainer cannot replace their own class' });
  }

  if (!useExternal) {
    const available = await isTrainerAvailableForReplacement({
      trainerId: replacementTrainerId,
      scheduleDay: schedule.day,
      leaveStart: leave.startDate,
      leaveEnd: leave.endDate,
      status: trainer.status,
    });
    if (!available) {
      return res.status(400).json({ message: 'Replacement trainer is on leave during this class' });
    }
  }

  if (!Array.isArray(leave.replacements)) {
    leave.replacements = [];
  }

  const existingIndex = leave.replacements.findIndex(
    (entry) => entry.schedule.toString() === scheduleId.toString()
  );
  const previousEntry = existingIndex >= 0 ? leave.replacements[existingIndex] : null;
  const previousWasExternal = Boolean(previousEntry?.isExternal);
  const previousExternalName = previousWasExternal
    ? String(previousEntry.externalTrainerName || '').trim()
    : '';
  const previousReplacementId = !previousWasExternal && previousEntry?.replacementTrainer
    ? previousEntry.replacementTrainer.toString()
    : '';

  const assignmentChanged = useExternal
    ? !previousWasExternal || previousExternalName !== externalName || Boolean(previousReplacementId)
    : previousWasExternal || previousReplacementId !== replacementTrainerId.toString();

  const previousReplacementTrainer = assignmentChanged && previousReplacementId
    ? await Trainer.findById(previousReplacementId).select('name employeeId')
    : null;

  const replacementPayload = {
    schedule: scheduleId,
    replacementTrainer: useExternal ? null : replacementTrainerId,
    isExternal: useExternal,
    externalTrainerName: useExternal ? externalName : '',
    assignedAt: new Date(),
    assignedBy: req.user._id,
  };

  if (existingIndex >= 0) {
    leave.replacements[existingIndex].replacementTrainer = replacementPayload.replacementTrainer;
    leave.replacements[existingIndex].isExternal = replacementPayload.isExternal;
    leave.replacements[existingIndex].externalTrainerName = replacementPayload.externalTrainerName;
    leave.replacements[existingIndex].assignedAt = replacementPayload.assignedAt;
    leave.replacements[existingIndex].assignedBy = replacementPayload.assignedBy;
  } else {
    leave.replacements.push(replacementPayload);
  }

  leave.markModified('replacements');
  await leave.save();
  clearAttendanceGridCache();

  const resolvedReplacement = useExternal
    ? { _id: null, name: externalName, employeeId: null, isExternal: true }
    : {
      _id: trainer._id,
      name: trainer.name,
      employeeId: trainer.employeeId,
      isExternal: false,
    };

  if (assignmentChanged) {
    try {
      await notifyReplacementAssignment({
        actor: req.user,
        leave,
        schedule,
        originalTrainer: leave.trainer,
        replacementTrainer: resolvedReplacement,
        previousReplacementTrainer,
        affectedDateKeys,
      });
    } catch (error) {
      // Assignment is already durable; notification failure must not roll it back.
      console.error('Failed to send replacement assignment notifications:', error.message);
    }
  }

  res.json({
    schedule,
    replacement: resolvedReplacement,
  });
};

export const getTrainerAvailability = async (req, res) => {
  const { start, end, trainerId, subjectId, slotStart, slotEnd } = req.query;

  if (!start || !end) {
    return res.status(400).json({ message: 'Start and end dates are required' });
  }

  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (endDate < startDate) {
    return res.status(400).json({ message: 'End date must be on or after start date' });
  }

  if (slotStart && slotEnd && timeToMinutes(slotEnd) <= timeToMinutes(slotStart)) {
    return res.status(400).json({ message: 'End time must be after start time' });
  }

  const trainerIds = trainerId ? [trainerId] : null;
  const data = await buildTrainerAvailabilityForRange({
    startDate,
    endDate,
    trainerIds,
    subjectId: subjectId || null,
    slotStart: slotStart || null,
    slotEnd: slotEnd || null,
  });

  res.json(data);
};

export const getTrainerSlotsForReplacement = async (req, res) => {
  const { trainerId, date } = req.query;

  if (!trainerId || !date) {
    return res.status(400).json({ message: 'Trainer and date are required' });
  }

  const trainer = await Trainer.findById(trainerId);
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  const slotDate = normalizeDate(date);
  const dayName = WEEKDAYS[slotDate.getDay()];

  const [scheduledClasses, canceledScheduleIds] = await Promise.all([
    Schedule.find({
    trainerCode: { $in: resolveTrainerScheduleCodes(trainer) },
    day: dayName,
    }).sort({ startTime: 1, department: 1, section: 1 }),
    getCanceledScheduleIdsForDate(slotDate),
  ]);
  const schedules = scheduledClasses.filter(
    (schedule) => !canceledScheduleIds.has(schedule._id.toString())
  );

  res.json({
    trainer: {
      _id: trainer._id,
      name: trainer.name,
      employeeId: trainer.employeeId,
    },
    date: slotDate,
    day: dayName,
    schedules,
  });
};

export const createSlotReplacementRequest = async (req, res) => {
  const { trainerId, scheduleId, date, reason } = req.body;

  if (!trainerId || !scheduleId || !date) {
    return res.status(400).json({ message: 'Trainer, schedule slot, and date are required' });
  }

  const trainer = await Trainer.findById(trainerId);
  if (!trainer || trainer.status !== 'active') {
    return res.status(400).json({ message: 'Trainer not found or inactive' });
  }

  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    return res.status(404).json({ message: 'Schedule slot not found' });
  }

  const scheduleCodes = resolveTrainerScheduleCodes(trainer);
  if (!scheduleCodes.includes(schedule.trainerCode)) {
    return res.status(400).json({ message: 'Selected slot does not belong to this trainer' });
  }

  const slotDate = normalizeDate(date);
  const today = normalizeDate(new Date());
  if (slotDate < today) {
    return res.status(400).json({ message: 'Replacement date cannot be in the past' });
  }

  const dayName = WEEKDAYS[slotDate.getDay()];
  if (schedule.day !== dayName) {
    return res.status(400).json({ message: 'Selected slot does not occur on the chosen date' });
  }
  const canceledScheduleIds = await getCanceledScheduleIdsForDate(slotDate);
  if (canceledScheduleIds.has(schedule._id.toString())) {
    return res.status(400).json({
      message: 'This class is canceled on the selected date, so no replacement is needed.',
    });
  }

  const existing = await Leave.findOne({
    trainer: trainerId,
    status: 'approved',
    replacementNeeded: true,
    affectedSchedules: scheduleId,
    startDate: { $lte: slotDate },
    endDate: { $gte: slotDate },
  });
  if (existing) {
    return res.status(400).json({
      message: 'A replacement request already exists for this trainer and slot on the selected date',
    });
  }

  const leave = await Leave.create({
    trainer: trainerId,
    startDate: slotDate,
    endDate: slotDate,
    reason: reason?.trim() || 'Ad-hoc slot replacement',
    scope: LEAVE_SCOPES.SLOT,
    status: 'approved',
    affectedSchedules: [scheduleId],
    replacementNeeded: true,
    approvedBy: req.user._id,
    approvedAt: new Date(),
  });

  const populated = await Leave.findById(leave._id)
    .populate('trainer', 'name employeeId')
    .populate('affectedSchedules');

  res.status(201).json({
    leave: populated,
    schedule,
  });
};
