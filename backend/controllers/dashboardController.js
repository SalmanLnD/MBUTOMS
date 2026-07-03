import Trainer from '../models/Trainer.js';

import Student from '../models/Student.js';

import Venue from '../models/Venue.js';

import Leave from '../models/Leave.js';

import Attendance from '../models/Attendance.js';
import { enrichSchedulesWithReplacementFor } from '../utils/scheduleReplacement.js';
import { getActiveSchedulesForDay } from '../utils/activeSchedulesForDate.js';



const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];



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

      replacementNeeded: true,

      endDate: { $gte: today },

      affectedSchedules: { $exists: true, $not: { $size: 0 } },

    }).select('affectedSchedules replacements'),

    getActiveSchedulesForDay(todayName, today),

  ]);

  const todaysClasses = activeToday.count;

  const pendingReplacements = replacementLeaves.reduce((count, leave) => {
    const assignedScheduleIds = new Set(
      (leave.replacements || [])
        .map((entry) => entry.schedule?.toString())
        .filter(Boolean)
    );
    const unassigned = (leave.affectedSchedules || []).filter(
      (scheduleId) => !assignedScheduleIds.has(scheduleId.toString())
    );
    return count + unassigned.length;
  }, 0);



  const attendanceAgg = await Attendance.aggregate([

    { $match: { date: { $gte: today, $lt: tomorrow } } },

    { $group: { _id: '$status', count: { $sum: 1 } } },

  ]);



  const attendanceSummary = { present: 0, absent: 0, late: 0, leave: 0, od: 0, holiday: 0 };

  attendanceAgg.forEach((s) => {

    if (s._id && attendanceSummary[s._id] !== undefined) {

      attendanceSummary[s._id] = s.count;

    }

  });



  const trainerPerformance = await Trainer.find()

    .select('name employeeId performanceScore weeklyWorkloadHours')

    .sort({ performanceScore: -1 })

    .limit(5);



  const upcomingClasses = await enrichSchedulesWithReplacementFor(
    [...activeToday.schedules]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 5),
    new Date()
  );



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

    trainerPerformance,

    upcomingClasses,

  });

};

