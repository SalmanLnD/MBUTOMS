import { getLeaveWeekdayScheduleIds, isFullDayLeave } from './leaveScope.js';
import { getLeaveOverlapFilter } from './leaveDateRange.js';

const conflictError = () => {
  const error = new Error('An active leave or break request already exists for this trainer in the selected date range. Review the existing request before applying again.');
  error.statusCode = 409;
  return error;
};

/**
 * Serialize full-day leave creation per trainer across all API instances.
 * The trainer write must precede the overlap read: concurrent transactions
 * conflict on that document and MongoDB retries the losing transaction with
 * a fresh snapshot, where it can see the first request's committed leave.
 */
export const createLeaveWithoutOverlap = async ({ Leave, Trainer, data, findLegacySchedules }) =>
  Leave.db.transaction(async (session) => {
    const trainer = await Trainer.updateOne(
      { _id: data.trainer },
      { $inc: { __v: 1 } },
      { session, timestamps: false },
    );
    if (!trainer.matchedCount) {
      const error = new Error('Trainer not found');
      error.statusCode = 404;
      throw error;
    }

    const overlaps = await Leave.find({
      trainer: data.trainer,
      status: { $in: ['pending', 'approved'] },
      ...getLeaveOverlapFilter(data.startDate, data.endDate),
    }).session(session).lean();

    for (const leave of overlaps) {
      // Legacy rows can be slot-only requests. Resolve their scope using the
      // same timetable-aware rule as attendance instead of assuming full-day.
      const dayScheduleIds = leave.scope || leave.reason === 'Ad-hoc slot replacement'
        ? null
        : getLeaveWeekdayScheduleIds(leave, await findLegacySchedules(leave, session));
      if (isFullDayLeave(leave, { dayScheduleIds })) throw conflictError();
    }

    const [leave] = await Leave.create([data], { session });
    return leave;
  });
