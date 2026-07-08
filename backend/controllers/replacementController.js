import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';
import { isTrainerAvailableForReplacement } from '../utils/leaveStatus.js';
import { buildTrainerAvailabilityForRange } from '../utils/trainerAvailability.js';

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

  if (!record?.replacementTrainer) return null;

  if (typeof record.replacementTrainer === 'object' && record.replacementTrainer.name) {
    return record.replacementTrainer;
  }

  const trainerId = record.replacementTrainer.toString();
  return trainersById.get(trainerId) || null;
};

export const getReplacementSuggestions = async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

  const leave = await Leave.findOne({
    affectedSchedules: schedule._id,
    status: 'approved',
  });
  if (!leave) {
    return res.status(400).json({ message: 'No approved leave found for this schedule' });
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
  });

  const eligibleSuggestions = [];
  const otherSuggestions = [];

  for (const trainer of trainers) {
    const available = await isTrainerAvailableForReplacement({
      trainerId: trainer._id,
      scheduleDay: schedule.day,
      leaveStart: leave.startDate,
      leaveEnd: leave.endDate,
      status: trainer.status,
    });
    if (!available) continue;

    const scheduleCodes = resolveTrainerScheduleCodes(trainer);

    const daySchedules = await Schedule.find({
      trainerCode: { $in: scheduleCodes },
      day: schedule.day,
    });
    const hasConflict = daySchedules.some((s) =>
      timesOverlap(schedule.startTime, schedule.endTime, s.startTime, s.endTime)
    );
    if (hasConflict) continue;

    const weekSchedules = await Schedule.find({ trainerCode: { $in: scheduleCodes } });
    const weeklyHours = weekSchedules.reduce((sum, s) => {
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
    suggestions: eligibleSuggestions.slice(0, 5),
    otherSuggestions: otherSuggestions.slice(0, 5),
  });
};

export const getPendingReplacements = async (req, res) => {
  const today = normalizeDate(new Date());
  const approvedLeaves = await Leave.find({
    status: 'approved',
    replacementNeeded: true,
    endDate: { $gte: today },
    affectedSchedules: { $exists: true, $not: { $size: 0 } },
  })
    .populate('trainer', 'name employeeId')
    .populate('affectedSchedules')
    .populate({
      path: 'replacements.replacementTrainer',
      select: 'name employeeId',
    });

  const pending = [];
  const replacementTrainerIds = new Set();

  for (const leave of approvedLeaves) {
    leave.replacements?.forEach((entry) => {
      const trainerId = entry.replacementTrainer?._id?.toString() || entry.replacementTrainer?.toString();
      if (trainerId) replacementTrainerIds.add(trainerId);
    });
  }

  const replacementTrainers = replacementTrainerIds.size
    ? await Trainer.find({ _id: { $in: [...replacementTrainerIds] } }).select('name employeeId')
    : [];
  const trainersById = new Map(replacementTrainers.map((trainer) => [trainer._id.toString(), trainer]));

  for (const leave of approvedLeaves) {
    for (const schedule of leave.affectedSchedules) {
      if (!schedule) continue;
      const replacement = resolveReplacementTrainer(leave, schedule, trainersById);
      pending.push({
        leave: {
          _id: leave._id,
          trainer: leave.trainer,
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: leave.reason,
        },
        schedule,
        replacement,
        replacementDate: leave.startDate,
        isSlotReplacement:
          normalizeDate(leave.startDate).getTime() === normalizeDate(leave.endDate).getTime(),
      });
    }
  }

  res.json({ pending, count: pending.length });
};

export const assignReplacement = async (req, res) => {
  const { scheduleId, replacementTrainerId } = req.body;

  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

  const trainer = await Trainer.findById(replacementTrainerId);
  if (!trainer || trainer.status !== 'active') {
    return res.status(400).json({ message: 'Replacement trainer is not available' });
  }

  const leave = await Leave.findOne({
    affectedSchedules: scheduleId,
    status: 'approved',
  }).populate('trainer', 'name employeeId');
  if (!leave) {
    return res.status(400).json({ message: 'No approved leave found for this schedule' });
  }

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

  if (!Array.isArray(leave.replacements)) {
    leave.replacements = [];
  }

  const replacementEntry = {
    schedule: scheduleId,
    replacementTrainer: replacementTrainerId,
    assignedAt: new Date(),
    assignedBy: req.user._id,
  };

  const existingIndex = leave.replacements.findIndex(
    (entry) => entry.schedule.toString() === scheduleId.toString()
  );
  if (existingIndex >= 0) {
    leave.replacements[existingIndex].replacementTrainer = replacementTrainerId;
    leave.replacements[existingIndex].assignedAt = new Date();
    leave.replacements[existingIndex].assignedBy = req.user._id;
  } else {
    leave.replacements.push(replacementEntry);
  }

  leave.markModified('replacements');
  await leave.save();

  res.json({
    schedule,
    replacement: {
      _id: trainer._id,
      name: trainer.name,
      employeeId: trainer.employeeId,
    },
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

  const schedules = await Schedule.find({
    trainerCode: { $in: resolveTrainerScheduleCodes(trainer) },
    day: dayName,
  }).sort({ startTime: 1, department: 1, section: 1 });

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
