import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import Student from '../models/Student.js';
import ClassGroup from '../models/ClassGroup.js';
import TopicTrackerEntry from '../models/TopicTrackerEntry.js';
import Leave from '../models/Leave.js';
import { filterSchedulesActiveOnDate } from './activeSchedulesForDate.js';
import { getCanceledScheduleIdsForDate } from './classCancellations.js';
import { computeHours } from './trainerClassHours.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { ROLES } from './roles.js';
import {
  getCoordinatorSubjectIds,
  isSubjectCoordinator,
  buildTrainerFilterForCoordinatorSubjects,
} from './subjectCoordinatorAccess.js';
import { getTopicOptionsForSubjectDoc } from './topicTrackerTopicCatalog.js';
import { getLeaveDayWindow, getLeaveOverlapFilter, toLeaveDateKey } from './leaveDateRange.js';
import {
  formatTopicModulesCovered,
  getEntryTopicModules,
} from './topicTrackerEntryTopics.js';
import {
  buildStudentCountKey,
  getStudentCountForClass,
  resolveAllottedStudents,
} from './studentCountByClass.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDateKey = (date) => toLeaveDateKey(date);

const toOperationalNoon = (dateInput) => {
  const key = toLeaveDateKey(dateInput);
  return new Date(`${key}T12:00:00+05:30`);
};

const pickBestTrackerEntry = (entries = []) => {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => {
    const closedDiff = Number(b.trackerStatus === 'closed') - Number(a.trackerStatus === 'closed');
    if (closedDiff) return closedDiff;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  })[0];
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
        _id: {
          department: '$branch',
          section: '$sectionLabel',
          semester: '$semesterLabel',
        },
        studentCount: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    counts.map((row) => [
      buildStudentCountKey(row._id.department, row._id.section, row._id.semester),
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
  const trainers = await Trainer.find().select('name employeeId scheduleTrainerCodes subjects').lean();
  const byCode = new Map();
  const byId = new Map();
  trainers.forEach((trainer) => {
    byId.set(trainer._id.toString(), trainer);
    const codes = resolveTrainerScheduleCodes(trainer);
    codes.forEach((code) => {
      byCode.set(code, trainer);
    });
  });
  return { byCode, byId };
};

const buildReplacementMap = async (scheduleIds, ref) => {
  if (!scheduleIds.length) return new Map();
  const leaves = await Leave.find({
    status: 'approved',
    ...getLeaveOverlapFilter(ref),
    'replacements.schedule': { $in: scheduleIds },
  }).select(
    'replacements.schedule replacements.replacementTrainer replacements.isExternal replacements.externalTrainerName'
  ).lean();

  const replacementBySchedule = new Map();
  leaves.forEach((leave) => {
    (leave.replacements || []).forEach((replacement) => {
      const scheduleId = replacement.schedule?.toString();
      if (!scheduleId) return;

      if (replacement.isExternal && replacement.externalTrainerName) {
        replacementBySchedule.set(scheduleId, {
          isExternal: true,
          name: replacement.externalTrainerName,
        });
        return;
      }

      const replacementTrainerId = replacement.replacementTrainer?.toString();
      if (replacementTrainerId) {
        replacementBySchedule.set(scheduleId, {
          isExternal: false,
          trainerId: replacementTrainerId,
        });
      }
    });
  });
  return replacementBySchedule;
};

const computeAttendancePercent = (allotted, present) => {
  if (!allotted || allotted <= 0) return null;
  const value = Math.round((present / allotted) * 1000) / 10;
  return Number.isFinite(value) ? value : null;
};

export const mergeOverviewTrainerNames = (currentNames = [], session = {}) => {
  const names = session.replacementTrainerName
    ? [session.originalTrainerName, session.replacementTrainerName]
    : [session.originalTrainerName || session.trainerName];

  return names.filter(Boolean).reduce((result, name) => {
    const trimmed = String(name).trim();
    if (
      trimmed
      && !result.some((existing) =>
        existing.localeCompare(trimmed, undefined, { sensitivity: 'base' }) === 0
      )
    ) {
      result.push(trimmed);
    }
    return result;
  }, [...currentNames]);
};

const entryToSession = (entry, defaults) => ({
  entryId: entry?._id?.toString() || null,
  scheduleId: defaults.scheduleId,
  date: defaults.dateKey,
  day: defaults.day,
  slot: defaults.slot,
  trainerId: defaults.trainerId,
  trainerName: defaults.isReplacementAssignment
    ? defaults.trainerName
    : (entry?.trainerName || defaults.trainerName),
  originalTrainerId: defaults.originalTrainerId,
  originalTrainerName: defaults.originalTrainerName,
  replacementTrainerId: defaults.replacementTrainerId,
  replacementTrainerName: defaults.replacementTrainerName,
  subjectId: defaults.subjectId,
  subjectCode: defaults.subjectCode,
  courseName: entry?.courseName || defaults.courseName,
  branchYearSection: entry?.branchYearSection || defaults.branchYearSection,
  roomNo: entry?.roomNo || defaults.roomNo,
  topicModuleCovered: formatTopicModulesCovered(
    entry?.topicModulesCovered,
    entry?.topicModuleCovered
  ),
  topicModulesCovered: getEntryTopicModules(entry),
  sessionStartTime: entry?.sessionStartTime || defaults.sessionStartTime,
  sessionEndTime: entry?.sessionEndTime || defaults.sessionEndTime,
  durationHrs: entry?.durationHrs ?? defaults.durationHrs,
  allottedStudents: resolveAllottedStudents(entry?.allottedStudents, defaults.allottedStudents),
  noPresent: entry?.noPresent ?? 0,
  attendancePercent: entry?.attendancePercent ?? computeAttendancePercent(
    resolveAllottedStudents(entry?.allottedStudents, defaults.allottedStudents),
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
  // lite: overview-only projection — skips subject topics/topicOptions, venue,
  // student-count aggregate, and class-group lookup that the overview never reads.
  lite = false,
}) => {
  const dateKey = toLeaveDateKey(date);
  const dayWindow = getLeaveDayWindow(dateKey);
  const ref = toOperationalNoon(dateKey);
  const dayName = WEEKDAYS[ref.getUTCDay()];

  const scheduleFilter = { day: dayName };
  if (subjectId) scheduleFilter.subject = subjectId;

  let scheduleQuery = Schedule.find(scheduleFilter)
    .populate('subject', lite ? 'name code' : 'name code topics');
  if (!lite) {
    scheduleQuery = scheduleQuery.populate('venue', 'name building floor');
  }
  let schedules = await scheduleQuery.lean();

  const [
    activeSchedules,
    canceledScheduleIds,
    trainerLookup,
    studentCountMap,
    classGroupMap,
  ] = await Promise.all([
    filterSchedulesActiveOnDate(schedules, ref),
    getCanceledScheduleIdsForDate(ref),
    buildTrainerLookup(),
    lite ? new Map() : buildStudentCountMap(),
    lite ? new Map() : buildClassGroupMap(),
  ]);
  schedules = activeSchedules.filter(
    (schedule) => !canceledScheduleIds.has(schedule._id.toString())
  );
  const replacementBySchedule = await buildReplacementMap(
    schedules.map((schedule) => schedule._id),
    ref
  );

  let allowedTrainerIds = null;
  const ownTrainerId = user?.trainer ? String(user.trainer._id || user.trainer) : '';
  const viewingOwnClasses = Boolean(
    ownTrainerId
    && trainerId
    && trainerId.toString() === ownTrainerId
  );

  if (user?.role === ROLES.TRAINER && user.trainer) {
    allowedTrainerIds = new Set([ownTrainerId || user.trainer.toString()]);
  } else if (isSubjectCoordinator(user)) {
    const subjectIds = getCoordinatorSubjectIds(user);
    if (viewingOwnClasses) {
      // Own teaching slots for any subject (e.g. Sai Priya / PSTJ).
      allowedTrainerIds = new Set([ownTrainerId]);
    } else if (subjectId && !subjectIds.includes(subjectId.toString())) {
      // Personal teaching subject outside coordinator assignment.
      if (!ownTrainerId) {
        return { date: dateKey, day: dayName, sessions: [] };
      }
      allowedTrainerIds = new Set([ownTrainerId]);
    } else {
      const filter = await buildTrainerFilterForCoordinatorSubjects(subjectIds);
      allowedTrainerIds = new Set((filter._id?.$in || []).map((id) => id.toString()));
      if (ownTrainerId) allowedTrainerIds.add(ownTrainerId);
      if (!subjectId) {
        schedules = schedules.filter((schedule) => {
          const sid = schedule.subject?._id?.toString() || schedule.subject?.toString();
          return subjectIds.includes(sid);
        });
      }
    }
  }

  if (trainerId) {
    const targetId = trainerId.toString();
    allowedTrainerIds = allowedTrainerIds
      ? new Set([...allowedTrainerIds].filter((id) => id === targetId))
      : new Set([targetId]);
  }

  const sessionDefaults = [];

  schedules.forEach((schedule) => {
    const originalTrainer = trainerLookup.byCode.get(schedule.trainerCode);
    if (!originalTrainer) return;

    const replacementInfo = replacementBySchedule.get(schedule._id.toString());
    const externalReplacementName = replacementInfo?.isExternal
      ? String(replacementInfo.name || '').trim()
      : '';
    const replacementTrainerId = !replacementInfo?.isExternal
      ? replacementInfo?.trainerId
      : null;
    const replacementTrainer = replacementTrainerId
      ? trainerLookup.byId.get(replacementTrainerId)
      : null;
    const originalTrainerId = originalTrainer._id.toString();
    const targetTrainerId = trainerId?.toString();
    const targetIsOriginal = targetTrainerId === originalTrainerId;
    const targetIsReplacement = Boolean(
      replacementTrainer && targetTrainerId === replacementTrainer._id.toString()
    );

    if (targetTrainerId && !targetIsOriginal && !targetIsReplacement) return;
    if (
      allowedTrainerIds
      && !allowedTrainerIds.has(originalTrainerId)
      && !(replacementTrainer && allowedTrainerIds.has(replacementTrainer._id.toString()))
    ) return;

    // A replaced class remains one tracker record. Campus replacements can open it;
    // externals are name-only and do not own the tracker row or class hours.
    const displayTrainerName = replacementTrainer?.name
      || externalReplacementName
      || originalTrainer.name;

    const classKey = `${schedule.department}::${schedule.section}::${schedule.semester}`;
    const classGroup = classGroupMap.get(classKey);
    const allottedStudents = getStudentCountForClass(
      studentCountMap,
      schedule.department,
      schedule.section,
      schedule.semester
    );
    const venueName = schedule.venue?.name
      || [schedule.venue?.building, schedule.venue?.floor].filter(Boolean).join(' ')
      || '';

    const subjectCode = schedule.subjectCode || schedule.subject?.code || '';

    sessionDefaults.push({
      scheduleId: schedule._id.toString(),
      dateKey,
      day: dayName,
      slot: schedule.slot || '',
      trainerId: targetIsReplacement ? replacementTrainer._id.toString() : originalTrainerId,
      trainerName: displayTrainerName,
      isReplacementAssignment: Boolean(replacementTrainer || externalReplacementName),
      originalTrainerId,
      originalTrainerName: originalTrainer.name,
      replacementTrainerId: replacementTrainer?._id?.toString() || '',
      replacementTrainerName: replacementTrainer?.name || externalReplacementName || '',
      subjectId: schedule.subject?._id?.toString() || schedule.subject?.toString() || '',
      subjectCode,
      topicOptions: lite ? null : getTopicOptionsForSubjectDoc(schedule.subject),
      courseName: schedule.subject?.name || schedule.subjectCode || '',
      branchYearSection: buildBranchYearSection(schedule, classGroup),
      roomNo: venueName,
      sessionStartTime: schedule.startTime,
      sessionEndTime: schedule.endTime,
      durationHrs: computeHours(schedule.startTime, schedule.endTime),
      allottedStudents,
      scheduleRef: schedule._id,
      trainerRef: originalTrainer._id,
      subjectRef: schedule.subject?._id || schedule.subject,
    });
  });

  sessionDefaults.sort((a, b) => {
    const slotOrder = ['S1', 'S2', 'S3', 'S4', ''];
    const slotDiff = slotOrder.indexOf(a.slot || '') - slotOrder.indexOf(b.slot || '');
    if (slotDiff !== 0) return slotDiff;
    return String(a.sessionStartTime || '').localeCompare(String(b.sessionStartTime || ''));
  });

  const scheduleIds = sessionDefaults.map((item) => item.scheduleRef);
  const entries = await TopicTrackerEntry.find({
    date: { $gte: dayWindow.start, $lt: dayWindow.endExclusive },
    schedule: { $in: scheduleIds },
  }).lean();

  const entriesBySchedule = new Map();
  entries.forEach((entry) => {
    const key = entry.schedule.toString();
    if (!entriesBySchedule.has(key)) entriesBySchedule.set(key, []);
    entriesBySchedule.get(key).push(entry);
  });
  const entryMap = new Map(
    [...entriesBySchedule.entries()].map(([scheduleId, list]) => [
      scheduleId,
      pickBestTrackerEntry(list),
    ])
  );

  const sessions = sessionDefaults.map((defaults) => {
    const entry = entryMap.get(defaults.scheduleId);
    return entryToSession(entry, defaults);
  });

  return { date: dateKey, day: dayName, sessions };
};

export const buildTopicTrackerOverview = async ({ date, user }) => {
  const dateKey = toLeaveDateKey(date);
  const ref = toOperationalNoon(dateKey);
  const overviewMap = new Map();
  const seenSessionKeys = new Set();

  const addSessionsToOverview = (sessions) => {
    sessions.forEach((session) => {
      const dedupeKey = `${session.subjectId || session.subjectCode}::${session.scheduleId}::${session.date}`;
      if (seenSessionKeys.has(dedupeKey)) return;
      seenSessionKeys.add(dedupeKey);

      const subjectKey = session.subjectId || session.subjectCode || 'unknown';
      if (!overviewMap.has(subjectKey)) {
        overviewMap.set(subjectKey, {
          subjectId: session.subjectId,
          subjectName: session.courseName || session.subjectCode || 'Subject',
          subjectCode: session.subjectCode || '',
          allottedSlots: 0,
          pendingSlots: 0,
          trainers: new Map(),
        });
      }
      const subjectRow = overviewMap.get(subjectKey);
      subjectRow.allottedSlots += 1;
      if (session.trackerStatus !== 'closed') subjectRow.pendingSlots += 1;

      const trainerKey = session.originalTrainerId || session.trainerId;
      if (!subjectRow.trainers.has(trainerKey)) {
        const trainerNames = mergeOverviewTrainerNames([], session);
        subjectRow.trainers.set(trainerKey, {
          trainerId: trainerKey,
          trainerName: trainerNames.join(' / '),
          trainerNames,
          allottedSlots: 0,
          pendingSlots: 0,
          closedSlots: 0,
        });
      }
      const trainerRow = subjectRow.trainers.get(trainerKey);
      trainerRow.trainerNames = mergeOverviewTrainerNames(trainerRow.trainerNames, session);
      trainerRow.trainerName = trainerRow.trainerNames.join(' / ');
      trainerRow.allottedSlots += 1;
      if (session.trackerStatus === 'closed') {
        trainerRow.closedSlots += 1;
      } else {
        trainerRow.pendingSlots += 1;
      }
    });
  };

  // Load the day once. Previously this rebuilt trainer/student/class maps and
  // queried tracker entries again for every subject.
  const { sessions } = await buildTopicTrackerSessions({ date: ref, user, lite: true });
  addSessionsToOverview(sessions);

  // Coordinators who also teach should see their personal classes (e.g. Sai Priya / PSTJ).
  if (isSubjectCoordinator(user) && user.trainer) {
    const ownTrainerId = String(user.trainer._id || user.trainer);
    const { sessions: ownSessions } = await buildTopicTrackerSessions({
      date: ref,
      trainerId: ownTrainerId,
      user,
      lite: true,
    });
    addSessionsToOverview(ownSessions);
  }

  const overview = [...overviewMap.values()]
    .map((subject) => ({
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      subjectCode: subject.subjectCode,
      allottedSlots: subject.allottedSlots,
      pendingSlots: subject.pendingSlots,
      totalSlots: subject.allottedSlots,
      totalPending: subject.pendingSlots,
      trainers: [...subject.trainers.values()]
        .map((trainer) => ({
          ...trainer,
          // Aliases so UI always has a value for the allotted-slots column.
          totalSlots: trainer.allottedSlots,
          allottedSlots: trainer.allottedSlots,
          pendingSlots: trainer.pendingSlots,
          closedSlots: trainer.closedSlots,
        }))
        .sort((a, b) => String(a.trainerName || '').localeCompare(String(b.trainerName || ''))),
    }))
    .sort((a, b) => String(a.subjectName || '').localeCompare(String(b.subjectName || '')));

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
      formatTopicModulesCovered(entry.topicModulesCovered, entry.topicModuleCovered),
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

export const buildTopicTrackerClassSummary = async ({ subjectId, user, trainerId } = {}) => {
  const ownTrainerId = trainerId
    ? String(trainerId._id || trainerId)
    : (user?.role === ROLES.TRAINER && user.trainer
      ? String(user.trainer._id || user.trainer)
      : '');

  let subjects = [];
  let entryFilter = {
    trackerStatus: 'closed',
    $or: [
      { topicModulesCovered: { $exists: true, $ne: [] } },
      { topicModuleCovered: { $nin: [null, ''] } },
    ],
  };

  if (ownTrainerId) {
    entryFilter.trainer = ownTrainerId;
    if (subjectId) entryFilter.subject = subjectId;

    const [trainer, closedEntries] = await Promise.all([
      Trainer.findById(ownTrainerId).select('subjects').lean(),
      TopicTrackerEntry.find(entryFilter).select('subject').lean(),
    ]);

    const subjectIdSet = new Set([
      ...(trainer?.subjects || []).map((id) => id.toString()),
      ...closedEntries.map((entry) => entry.subject?.toString()).filter(Boolean),
    ]);

    if (subjectId) {
      const only = subjectId.toString();
      if (!subjectIdSet.has(only)) {
        return { subjects: [] };
      }
      subjects = await Subject.find({ _id: only }).select('name code topics').lean();
    } else {
      subjects = await Subject.find({ _id: { $in: [...subjectIdSet] } })
        .select('name code topics')
        .sort({ name: 1 })
        .lean();
    }
  } else {
    let subjectFilter = {};
    if (subjectId) {
      subjectFilter = { _id: subjectId };
    } else if (isSubjectCoordinator(user)) {
      subjectFilter = { _id: { $in: getCoordinatorSubjectIds(user) } };
    }

    subjects = await Subject.find(subjectFilter)
      .select('name code topics')
      .sort({ name: 1 })
      .lean();

    const subjectIds = subjects.map((subject) => subject._id);
    if (!subjectIds.length) {
      return { subjects: [] };
    }
    entryFilter.subject = { $in: subjectIds };
  }

  if (!subjects.length) {
    return { subjects: [] };
  }

  const entries = await TopicTrackerEntry.find(entryFilter)
    .select('subject trainer branchYearSection topicModuleCovered topicModulesCovered date sessionStatus allottedStudents noPresent attendancePercent trainerName')
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
      const trainerId = entry.trainer?.toString() || '';
      const trainerName = entry.trainerName || 'Unassigned trainer';
      const trainerKey = `${trainerId || 'unassigned'}::${trainerName}`;
      const branchYearSection = entry.branchYearSection || 'Unassigned class';
      const classKey = `${trainerKey}::${branchYearSection}`;
      if (!classMap.has(classKey)) {
        classMap.set(classKey, {
          trainerKey,
          trainerId,
          trainerName,
          branchYearSection,
          closedSlots: 0,
          topicHits: new Map(),
          attendanceSum: 0,
          attendanceCount: 0,
        });
      }
      const row = classMap.get(classKey);
      row.closedSlots += 1;
      getEntryTopicModules(entry).forEach((topic) => {
        const existing = row.topicHits.get(topic) || { topic, count: 0, lastDate: null };
        existing.count += 1;
        const entryDate = entry.date ? formatDateKey(entry.date) : null;
        if (!existing.lastDate || (entryDate && entryDate > existing.lastDate)) {
          existing.lastDate = entryDate;
        }
        row.topicHits.set(topic, existing);
      });
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
          if (aIndex === -1 && bIndex === -1) {
            return String(a.topic || '').localeCompare(String(b.topic || ''));
          }
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
        const coveredSet = new Set(coveredTopics.map((item) => item.topic));
        const uncoveredTopics = syllabusTopics.filter((topic) => !coveredSet.has(topic));
        return {
          trainerKey: row.trainerKey,
          trainerId: row.trainerId,
          trainerName: row.trainerName,
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
      .sort((a, b) =>
        String(a.trainerName || '').localeCompare(String(b.trainerName || ''))
        || String(a.branchYearSection || '').localeCompare(String(b.branchYearSection || ''))
      );

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
