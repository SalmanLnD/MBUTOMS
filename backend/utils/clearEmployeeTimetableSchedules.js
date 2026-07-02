import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';

export const EMPLOYEE_IDS_WITHOUT_TIMETABLE = [
  '135310',
  '135402',
  '135517',
  '135621',
  '135887',
  '136047',
  '801406',
];

export const clearEmployeeTimetableSchedules = async () => {
  const schedules = await Schedule.find({
    trainerCode: { $in: EMPLOYEE_IDS_WITHOUT_TIMETABLE },
  }).select('_id');

  const scheduleIds = schedules.map((schedule) => schedule._id);

  if (scheduleIds.length) {
    await Leave.updateMany(
      { affectedSchedules: { $in: scheduleIds } },
      { $pull: { affectedSchedules: { $in: scheduleIds } } }
    );
    await Leave.updateMany(
      { 'replacements.schedule': { $in: scheduleIds } },
      { $pull: { replacements: { schedule: { $in: scheduleIds } } } }
    );
  }

  const result = await Schedule.deleteMany({
    trainerCode: { $in: EMPLOYEE_IDS_WITHOUT_TIMETABLE },
  });

  return { deletedCount: result.deletedCount };
};
