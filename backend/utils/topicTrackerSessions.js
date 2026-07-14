import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import Student from '../models/Student.js';
import ClassGroup from '../models/ClassGroup.js';
import TopicTrackerEntry from '../models/TopicTrackerEntry.js';
import { normalizeDate } from './scheduleHelpers.js';
import { filterSchedulesActiveOnDate } from './activeSchedulesForDate.js';
import { computeHours } from './trainerClassHours.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { ROLES } from './roles.js';
import {
  getCoordinatorSubjectIds,
  isSubjectCoordinator,
  buildTrainerFilterForCoordinatorSubjects,
} from './subjectCoordinatorAccess.js';
import { getTopicOptionsForSubjectDoc } from './topicTrackerTopicCatalog.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDateKey = (date) => {
  const base = normalizeDate(date);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildBranchYearSection = (schedule, classGroup) => {
  const department = schedule.department || '';
  const section = schedule.section || '';
  const semester = schedule.semester || '';
  if (classGroup?.py) {
    return `${department}, PY ${classGroup.py} Sem ${semester} - ${section}`;
  }
  return `${department}, Sem ${semester} - ${section}`;
};

const buildStudentCountMap = async () => {
  const counts = await Student.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: { department: '$branch', section: '$sectionLabel' },
        studentCount: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    counts.map((row) => [
      `${row._id.department}::${row._id.section}`,
      row.studentCount,
    ])
  );
};

const buildClassGroupMap = async () => {
  const classes = await ClassGroup.find({ status: 'active' }).lean();
  const map = new Map();
  classes.forEach((cls) => {
    const key = `${cls.department}::${cls.section}::${cls.currentSemester}`;
    map.set(key, cls);
  });
  return map;
};

const buildTrainerLookup = async () => {
  const trainers = await Trainer.find().select('name employeeId scheduleTrainerCodes subjects');
  const byCode = new Map();
  trainers.forEach((trainer) => {
    const codes = resolveTrainerScheduleCodes(trainer);
    codes.forEach((code) => {
      byCode.set(code, trainer);
    });
  });
  return byCode;
};

const computeAttendancePercent = (allotted, present) => {
  if (!allotted || allotted <= 0) return null;
  const value = Math.round((present / allotted) * 1000) / 10;
  return Number.isFinite(value) ? value : null;
};

const entryToSession = (entry, defaults) => ({
  entryId: entry?._id?.toString() || null,
  scheduleId: defaults.scheduleId,
  date: defaults.dateKey,
  day: defaults.day,
  slot: defaults.slot,
  trainerId: defaults.trainerId,
  trainerName: entry?.trainerName || defaults.trainerName,
  subjectId: defaults.subjectId,
  subjectCode: defaults.subjectCode,
  courseName: entry?.courseName || defaults.courseName,
  branchYearSection: entry?.branchYearSection || defaults.branchYearSection,
  roomNo: entry?.roomNo || defaults.roomNo,
  topicModuleCovered: entry?.topicModuleCovered || '',
  sessionStartTime: entry?.sessionStartTime || defaults.sessionStartTime,
  sessionEndTime: entry?.sessionEndTime || defaults.sessionEndTime,
  durationHrs: entry?.durationHrs ?? defaults.durationHrs,
  allottedStudents: entry?.allottedStudents ?? defaults.allottedStudents,
  noPresent: entry?.noPresent ?? 0,
  attendancePercent: entry?.attendancePercent ?? computeAttendancePercent(
    entry?.allottedStudents ?? defaults.allottedStudents,
    entry?.noPresent ?? 0
  ),
  sessionStatus: entry?.sessionStatus || '',
  keyObservationsFeedback: entry?.keyObservationsFeedback || '',
  challengesFaced: entry?.challengesFaced || '',
  trackerStatus: entry?.trackerStatus || 'pending',
  closedAt: entry?.closedAt || null,
  topicOptions: defaults.topicOptions || null,
});

export const buildTopicTrackerSessions = async ({
  date,
  subjectId,
  trainerId,
  user,
}) => {
  const ref = normalizeDate(date);
  const dateKey = formatDateKey(ref);
  const dayName = WEEKDAYS[ref.getDay()];

  const scheduleFilter = { day: dayName };
  if (subjectId) scheduleFilter.subject = subjectId;

  let schedules = await Schedule.find(scheduleFilter)
    .populate('subject', 'name code topics')
    .populate('venue', 'name building floor')
    .lean();

  schedules = await filterSchedulesActiveOnDate(schedules, ref);

  const trainerByCode = await buildTrainerLookup();
  const studentCountMap = await buildStudentCountMap();
  const classGroupMap = await buildClassGroupMap();

  let allowedTrainerIds = null;
  if (user?.role === ROLES.TRAINER && user.trainer) {
    allowedTrainerIds = new Set([user.trainer.toString()]);
  } else if (isSubjectCoordinator(user)) {
    const subjectIds = getCoordinatorSubjectIds(user);
    const filter = await buildTrainerFilterForCoordinatorSubjects(subjectIds);
    allowedTrainerIds = new Set((filter._id?.$in || []).map((id) => id.toString()));
    if (subjectId && !subjectIds.includes(subjectId.toString())) {
      return { date: dateKey, day: dayName, sessions: [] };
    }
    if (!subjectId) {
      schedules = schedules.filter((schedule) => {
        const sid = schedule.subject?._id?.toString() || schedule.subject?.toString();
        return subjectIds.includes(sid);
      });
    }
  }

  if (trainerId) {
    allowedTrainerIds = allowedTrainerIds
      ? new Set([...allowedTrainerIds].filter((id) => id === trainerId.toString()))
      : new Set([trainerId.toString()]);
  }

  const sessionDefaults = [];

  schedules.forEach((schedule) => {
    const trainer = trainerByCode.get(schedule.trainerCode);
    if (!trainer) return;
    if (allowedTrainerIds && !allowedTrainerIds.has(trainer._id.toString())) return;

    const classKey = `${schedule.department}::${schedule.section}::${schedule.semester}`;
    const classGroup = classGroupMap.get(classKey);
    const studentKey = `${schedule.department}::${schedule.section}`;
    const allottedStudents = studentCountMap.get(studentKey) || 0;
    const venueName = schedule.venue?.name
      || [schedule.venue?.building, schedule.venue?.floor].filter(Boolean).join(' ')
      || '';

    const subjectCode = schedule.subjectCode || schedule.subject?.code || '';

    sessionDefaults.push({
      scheduleId: schedule._id.toString(),
      dateKey,
      day: dayName,
      slot: schedule.slot || '',
      trainerId: trainer._id.toString(),
      trainerName: trainer.name,
      subjectId: schedule.subject?._id?.toString() || schedule.subject?.toString() || '',
      subjectCode,
      topicOptions: getTopicOptionsForSubjectDoc(schedule.subject),
      courseName: schedule.subject?.name || schedule.subjectCode || '',
      branchYearSection: buildBranchYearSection(schedule, classGroup),
      roomNo: venueName,
      sessionStartTime: schedule.startTime,
      sessionEndTime: schedule.endTime,
      durationHrs: computeHours(schedule.startTime, schedule.endTime),
      allottedStudents,
      scheduleRef: schedule._id,
      trainerRef: trainer._id,
      subjectRef: schedule.subject?._id || schedule.subject,
    });
  });

  sessionDefaults.sort((a, b) => {
    const slotOrder = ['S1', 'S2', 'S3', 'S4', ''];
    const slotDiff = slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot);
    if (slotDiff !== 0) return slotDiff;
    return a.sessionStartTime.localeCompare(b.sessionStartTime);
  });

  const scheduleIds = sessionDefaults.map((item) => item.scheduleRef);
  const entries = await TopicTrackerEntry.find({
    date: ref,
    schedule: { $in: scheduleIds },
  }).lean();

  const entryMap = new Map(
    entries.map((entry) => [entry.schedule.toString(), entry])
  );

  const sessions = sessionDefaults.map((defaults) => {
    const entry = entryMap.get(defaults.scheduleId);
    return entryToSession(entry, defaults);
  });

  return { date: dateKey, day: dayName, sessions };
};

export const buildTopicTrackerOverview = async ({ date, user }) => {
  const ref = normalizeDate(date);
  const dateKey = formatDateKey(ref);

  let subjectFilter = {};
  if (isSubjectCoordinator(user)) {
    const subjectIds = getCoordinatorSubjectIds(user);
    subjectFilter = { _id: { $in: subjectIds } };
  }

  const subjects = await Subject.find(subjectFilter).select('name code').sort({ name: 1 }).lean();
  const overview = [];

  for (const subject of subjects) {
    const { sessions } = await buildTopicTrackerSessions({
      date: ref,
      subjectId: subject._id.toString(),
      user,
    });

    if (!sessions.length) continue;

    const trainerMap = new Map();
    sessions.forEach((session) => {
      const key = session.trainerId;
      if (!trainerMap.has(key)) {
        trainerMap.set(key, {
          trainerId: session.trainerId,
          trainerName: session.trainerName,
          totalSlots: 0,
          pendingSlots: 0,
          closedSlots: 0,
        });
      }
      const row = trainerMap.get(key);
      row.totalSlots += 1;
      if (session.trackerStatus === 'closed') {
        row.closedSlots += 1;
      } else {
        row.pendingSlots += 1;
      }
    });

    const trainers = [...trainerMap.values()].sort((a, b) => a.trainerName.localeCompare(b.trainerName));
    const totalPending = trainers.reduce((sum, row) => sum + row.pendingSlots, 0);

    overview.push({
      subjectId: subject._id.toString(),
      subjectName: subject.name,
      subjectCode: subject.code,
      totalSlots: sessions.length,
      totalPending,
      trainers,
    });
  }

  return { date: dateKey, subjects: overview };
};

export const buildTopicTrackerExportRows = async () => {
  const entries = await TopicTrackerEntry.find()
    .populate('trainer', 'name employeeId')
    .populate('subject', 'name code')
    .sort({ date: -1, sessionStartTime: 1 })
    .lean();

  const header = [
    'Date',
    'Trainer Name',
    'Branch, Year & Section',
    'Room No',
    'Course Name',
    'Topic / Module Covered',
    'Session Start Time',
    'Session End Time',
    'Duration (Hrs)',
    'Allotted students',
    'No. Present',
    'Attendance %',
    'Session Status',
    'Key Observations / Feedback',
    'Challenges Faced',
    'Tracker Status',
    'Subject Code',
    'Trainer ID',
  ];

  const rows = [header];
  entries.forEach((entry) => {
    const dateKey = formatDateKey(entry.date);
    rows.push([
      dateKey,
      entry.trainerName || entry.trainer?.name || '',
      entry.branchYearSection || '',
      entry.roomNo || '',
      entry.courseName || entry.subject?.name || '',
      entry.topicModuleCovered || '',
      entry.sessionStartTime || '',
      entry.sessionEndTime || '',
      entry.durationHrs ?? '',
      entry.allottedStudents ?? '',
      entry.noPresent ?? '',
      entry.attendancePercent ?? '',
      entry.sessionStatus || '',
      entry.keyObservationsFeedback || '',
      entry.challengesFaced || '',
      entry.trackerStatus || 'pending',
      entry.subject?.code || '',
      entry.trainer?.employeeId || '',
    ]);
  });

  return { rows, exportedAt: new Date().toISOString(), count: entries.length };
};

export const buildTopicTrackerClassSummary = async ({ subjectId, user }) => {
  let subjectFilter = {};
  if (subjectId) {
    subjectFilter = { _id: subjectId };
  } else if (isSubjectCoordinator(user)) {
    subjectFilter = { _id: { $in: getCoordinatorSubjectIds(user) } };
  }

  const subjects = await Subject.find(subjectFilter)
    .select('name code topics')
    .sort({ name: 1 })
    .lean();

  const subjectIds = subjects.map((subject) => subject._id);
  if (!subjectIds.length) {
    return { subjects: [] };
  }

  const entries = await TopicTrackerEntry.find({
    subject: { $in: subjectIds },
    trackerStatus: 'closed',
    topicModuleCovered: { $nin: [null, ''] },
  })
    .select('subject branchYearSection topicModuleCovered date sessionStatus allottedStudents noPresent attendancePercent trainerName')
    .sort({ date: 1 })
    .lean();

  const entriesBySubject = new Map();
  entries.forEach((entry) => {
    const sid = entry.subject?.toString();
    if (!entriesBySubject.has(sid)) entriesBySubject.set(sid, []);
    entriesBySubject.get(sid).push(entry);
  });

  const summarySubjects = subjects.map((subject) => {
    const syllabusTopics = getTopicOptionsForSubjectDoc(subject) || [];
    const subjectEntries = entriesBySubject.get(subject._id.toString()) || [];
    const classMap = new Map();

    subjectEntries.forEach((entry) => {
      const classKey = entry.branchYearSection || 'Unassigned class';
      if (!classMap.has(classKey)) {
        classMap.set(classKey, {
          branchYearSection: classKey,
          closedSlots: 0,
          topicHits: new Map(),
          attendanceSum: 0,
          attendanceCount: 0,
        });
      }
      const row = classMap.get(classKey);
      row.closedSlots += 1;
      const topic = String(entry.topicModuleCovered || '').trim();
      if (topic) {
        const existing = row.topicHits.get(topic) || { topic, count: 0, lastDate: null };
        existing.count += 1;
        const entryDate = entry.date ? formatDateKey(entry.date) : null;
        if (!existing.lastDate || (entryDate && entryDate > existing.lastDate)) {
          existing.lastDate = entryDate;
        }
        row.topicHits.set(topic, existing);
      }
      if (entry.attendancePercent != null && Number.isFinite(Number(entry.attendancePercent))) {
        row.attendanceSum += Number(entry.attendancePercent);
        row.attendanceCount += 1;
      }
    });

    const classes = [...classMap.values()]
      .map((row) => {
        const coveredTopics = [...row.topicHits.values()].sort((a, b) => {
          const aIndex = syllabusTopics.indexOf(a.topic);
          const bIndex = syllabusTopics.indexOf(b.topic);
          if (aIndex === -1 && bIndex === -1) return a.topic.localeCompare(b.topic);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
        const coveredSet = new Set(coveredTopics.map((item) => item.topic));
        const uncoveredTopics = syllabusTopics.filter((topic) => !coveredSet.has(topic));
        return {
          branchYearSection: row.branchYearSection,
          closedSlots: row.closedSlots,
          coveredCount: coveredTopics.filter((item) => syllabusTopics.includes(item.topic)).length,
          totalTopics: syllabusTopics.length,
          coveragePercent: syllabusTopics.length
            ? Math.round((coveredTopics.filter((item) => syllabusTopics.includes(item.topic)).length / syllabusTopics.length) * 1000) / 10
            : null,
          avgAttendance: row.attendanceCount
            ? Math.round((row.attendanceSum / row.attendanceCount) * 10) / 10
            : null,
          coveredTopics,
          uncoveredTopics,
        };
      })
      .sort((a, b) => a.branchYearSection.localeCompare(b.branchYearSection));

    return {
      subjectId: subject._id.toString(),
      subjectName: subject.name,
      subjectCode: subject.code,
      topics: syllabusTopics,
      topicCount: syllabusTopics.length,
      classes,
    };
  });

  return { subjects: summarySubjects };
};
