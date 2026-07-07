import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';

dotenv.config();

/**
 * Remove every timetable slot. Preserves trainer.subjects and subject.trainerEligible.
 * Clears leave records that reference deleted schedule IDs.
 */
export const clearAllTimetableSchedules = async () => {
  const schedules = await Schedule.find().select('_id');
  const scheduleIds = schedules.map((schedule) => schedule._id);

  let leavesUpdated = 0;

  if (scheduleIds.length) {
    const affectedResult = await Leave.updateMany(
      { affectedSchedules: { $in: scheduleIds } },
      { $set: { affectedSchedules: [] } }
    );
    const replacementResult = await Leave.updateMany(
      { 'replacements.schedule': { $in: scheduleIds } },
      { $set: { replacements: [] } }
    );
    leavesUpdated = (affectedResult.modifiedCount || 0) + (replacementResult.modifiedCount || 0);
  }

  const result = await Schedule.deleteMany({});

  return {
    deletedCount: result.deletedCount,
    leavesUpdated,
  };
};
