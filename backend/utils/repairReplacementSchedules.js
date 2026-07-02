import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Trainer from '../models/Trainer.js';

const getScheduleId = (value) => value?._id?.toString() || value?.toString();

export const repairReplacementSchedules = async () => {
  let migrated = 0;
  let restored = 0;

  const approvedLeaves = await Leave.find({ status: 'approved' })
    .populate('trainer', 'employeeId')
    .populate('affectedSchedules');

  const restoredIds = new Set();

  for (const leave of approvedLeaves) {
    const originalCode = leave.trainer?.employeeId;
    if (!originalCode) continue;

    if (!Array.isArray(leave.replacements)) {
      leave.replacements = [];
    }

    let leaveUpdated = false;

    for (const schedule of leave.affectedSchedules || []) {
      if (!schedule) continue;

      const scheduleId = schedule._id.toString();
      if (restoredIds.has(scheduleId)) continue;

      if (schedule.trainerCode !== originalCode) {
        const replacementTrainer = await Trainer.findOne({ employeeId: schedule.trainerCode });
        if (replacementTrainer) {
          const existing = leave.replacements.find(
            (entry) => getScheduleId(entry.schedule) === scheduleId
          );
          if (!existing) {
            leave.replacements.push({
              schedule: schedule._id,
              replacementTrainer: replacementTrainer._id,
              assignedAt: new Date(),
            });
            leaveUpdated = true;
            migrated += 1;
          }
        }
      }

      if (schedule.trainerCode !== originalCode || schedule.replacementFor?.trainerName) {
        schedule.trainerCode = originalCode;
        schedule.replacementFor = { trainerCode: '', trainerName: '' };
        await schedule.save();
        restoredIds.add(scheduleId);
        restored += 1;
      }
    }

    if (leaveUpdated) {
      leave.markModified('replacements');
      await leave.save();
    }
  }

  const orphaned = await Schedule.find({
    $or: [
      { 'replacementFor.trainerName': { $ne: '' } },
      { 'replacementFor.trainerCode': { $ne: '' } },
    ],
  });

  for (const schedule of orphaned) {
    const scheduleId = schedule._id.toString();
    if (restoredIds.has(scheduleId)) continue;

    const originalCode = schedule.replacementFor?.trainerCode?.trim();
    if (originalCode) {
      schedule.trainerCode = originalCode;
    }
    schedule.replacementFor = { trainerCode: '', trainerName: '' };
    await schedule.save();
    restoredIds.add(scheduleId);
    restored += 1;
  }

  return { migrated, restored };
};
