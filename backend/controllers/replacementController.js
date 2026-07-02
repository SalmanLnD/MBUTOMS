import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import { resolveTrainerScheduleCodes } from '../utils/trainerMappings.js';
import { isTrainerAvailableForReplacement } from '../utils/leaveStatus.js';

const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const timesOverlap = (startA, endA, startB, endB) =>
  parseTimeToMinutes(startA) < parseTimeToMinutes(endB) &&
  parseTimeToMinutes(endA) > parseTimeToMinutes(startB);

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

  const trainers = await Trainer.find({
    _id: { $ne: leave.trainer },
    status: 'active',
  });

  const suggestions = [];

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

    const teachesDept = await Schedule.findOne({
      trainerCode: { $in: scheduleCodes },
      department: schedule.department,
    });
    if (!teachesDept) continue;

    const weekSchedules = await Schedule.find({ trainerCode: { $in: scheduleCodes } });
    const weeklyHours = weekSchedules.reduce((sum, s) => {
      const diff = parseTimeToMinutes(s.endTime) - parseTimeToMinutes(s.startTime);
      return sum + diff / 60;
    }, 0);

    suggestions.push({
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
    });
  }

  suggestions.sort((a, b) => {
    if (a.weeklyHours !== b.weeklyHours) return a.weeklyHours - b.weeklyHours;
    return b.performanceScore - a.performanceScore;
  });

  res.json({
    schedule,
    suggestions: suggestions.slice(0, 5),
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
        },
        schedule,
        replacement,
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
