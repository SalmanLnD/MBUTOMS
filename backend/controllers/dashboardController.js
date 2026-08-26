import Trainer from '../models/Trainer.js';
import Student from '../models/Student.js';
import Venue from '../models/Venue.js';
import Leave from '../models/Leave.js';
import Attendance from '../models/Attendance.js';
import FeedbackResponse from '../models/FeedbackResponse.js';
import { getActiveSchedulesForDay } from '../utils/activeSchedulesForDate.js';
import {
  getEffectiveAffectedSchedules,
  getLeaveClassExclusionsForRange,
} from '../utils/leaveAffectedClasses.js';
import { PERFORMANCE_EXCLUDED_EMPLOYEE_IDS } from '../utils/trainerMappings.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const roundAvg = (value) => (value != null ? Math.round(value * 100) / 100 : null);

const getTopTrainersByFeedback = async () => {
  const rosterFilter = await mergeRosterFilter({
    status: 'active',
    employeeId: { $nin: PERFORMANCE_EXCLUDED_EMPLOYEE_IDS },
  }, { rosterOnly: true });

  const rosterTrainers = await Trainer.find(rosterFilter).select('_id').lean();
  const rosterIds = rosterTrainers.map((trainer) => trainer._id);
  if (!rosterIds.length) return [];

  return FeedbackResponse.aggregate([
    {
      $match: {
        trainer: { $in: rosterIds },
        rating: { $gte: 1, $lte: 5 },
      },
    },
    {
      $group: {
        _id: '$trainer',
        averageRating: { $avg: '$rating' },
        responseCount: { $sum: 1 },
      },
    },
    { $sort: { averageRating: -1, responseCount: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'trainers',
        localField: '_id',
        foreignField: '_id',
        as: 'trainer',
      },
    },
    { $unwind: '$trainer' },
    {
      $project: {
        _id: 1,
        name: '$trainer.name',
        employeeId: '$trainer.employeeId',
        averageRating: { $round: ['$averageRating', 2] },
        responseCount: 1,
      },
    },
  ]);
};

export const getDashboardStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayName = WEEKDAYS[today.getDay()];

  const [
    totalTrainers,
    totalStudents,
    activeVenues,
    todaysLeaves,
    replacementLeaves,
    attendanceAgg,
    topTrainersByFeedback,
    activeToday,
  ] = await Promise.all([
    Trainer.countDocuments(),
    Student.countDocuments({ status: 'active' }),
    Venue.countDocuments({ isActive: true }),
    Leave.countDocuments({
      status: 'approved',
      startDate: { $lte: tomorrow },
      endDate: { $gte: today },
    }),
    Leave.find({
      status: 'approved',
      endDate: { $gte: today },
      // Bound the window so open-ended future leaves don't blow up the
      // cancellation-map range scan.
      startDate: { $lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) },
      affectedSchedules: { $exists: true, $not: { $size: 0 } },
    })
      .select('startDate endDate affectedSchedules replacements')
      .populate('affectedSchedules', 'day')
      .lean(),
    Attendance.aggregate([
      { $match: { date: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    getTopTrainersByFeedback(),
    getActiveSchedulesForDay(todayName, today),
  ]);

  const todaysClasses = activeToday.count;

  const cancellationWindowEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const leaveRangeStart = replacementLeaves.reduce(
    (earliest, leave) => (leave.startDate < earliest ? leave.startDate : earliest),
    replacementLeaves[0]?.startDate
  );
  const leaveRangeEnd = replacementLeaves.reduce(
    (latest, leave) => (leave.endDate > latest ? leave.endDate : latest),
    replacementLeaves[0]?.endDate
  );
  const exclusions = replacementLeaves.length
    ? await getLeaveClassExclusionsForRange(
      leaveRangeStart,
      // Clamp so a months-long leave doesn't scan cancellations far into the future.
      leaveRangeEnd > cancellationWindowEnd ? cancellationWindowEnd : leaveRangeEnd
    )
    : { cancellationMap: new Map(), holidayDateKeys: new Set() };
  const { cancellationMap, holidayDateKeys } = exclusions;

  const pendingReplacements = replacementLeaves.reduce((count, leave) => {
    const assignedScheduleIds = new Set(
      (leave.replacements || [])
        .map((entry) => entry.schedule?.toString())
        .filter(Boolean)
    );
    const effectiveSchedules = getEffectiveAffectedSchedules(
      leave,
      leave.affectedSchedules,
      cancellationMap,
      holidayDateKeys
    );
    const unassigned = effectiveSchedules.filter(
      (schedule) => !assignedScheduleIds.has(schedule._id.toString())
    );
    return count + unassigned.length;
  }, 0);

  const attendanceSummary = { present: 0, absent: 0, late: 0, leave: 0, od: 0, holiday: 0 };
  attendanceAgg.forEach((s) => {
    if (s._id && attendanceSummary[s._id] !== undefined) {
      attendanceSummary[s._id] = s.count;
    }
  });

  res.json({
    cards: {
      totalTrainers,
      totalStudents,
      todaysClasses,
      todaysLeaves,
      activeVenues,
      pendingReplacements,
    },
    attendanceSummary,
    topTrainersByFeedback: topTrainersByFeedback.map((row) => ({
      ...row,
      averageRating: roundAvg(row.averageRating),
    })),
  });
};
