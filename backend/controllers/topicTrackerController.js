import TopicTrackerEntry from '../models/TopicTrackerEntry.js';
import { notifyAdminsOfTopicTrackerUpdate } from '../utils/topicTrackerNotifications.js';
import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';
import Leave from '../models/Leave.js';
import { ROLES, isAuthorizedRole, FULL_ACCESS_ROLES } from '../utils/roles.js';
import { TOPIC_TRACKER_STATUSES, SESSION_STATUS_VALUES } from '../utils/topicTrackerConstants.js';
import {
  buildTopicTrackerSessions,
  buildTopicTrackerOverview,
  buildTopicTrackerExportRows,
  buildTopicTrackerClassSummary,
} from '../utils/topicTrackerSessions.js';
import { computeHours } from '../utils/trainerClassHours.js';
import { normalizeDate } from '../utils/scheduleHelpers.js';
import { findTrainerByScheduleCode } from '../utils/trainerMappings.js';
import {
  coordinatorCanAccessTrainer,
  getCoordinatorSubjectIds,
  isSubjectCoordinator,
} from '../utils/subjectCoordinatorAccess.js';
import {
  getTopicOptionsForSubjectDoc,
  isAllowedTopicForSubject,
} from '../utils/topicTrackerTopicCatalog.js';
import Subject from '../models/Subject.js';

const MANAGEMENT_VIEW_ROLES = [...FULL_ACCESS_ROLES, ROLES.SUBJECT_COORDINATOR];

const computeAttendancePercent = (allotted, present) => {
  if (!allotted || allotted <= 0) return null;
  return Math.round((present / allotted) * 1000) / 10;
};

const isAssignedReplacementForDate = async (user, scheduleId, date) => {
  if (!user?.trainer || !scheduleId || !date) return false;
  const ref = normalizeDate(date);
  return Boolean(await Leave.exists({
    status: 'approved',
    startDate: { $lte: ref },
    endDate: { $gte: ref },
    replacements: {
      $elemMatch: {
        schedule: scheduleId,
        replacementTrainer: user.trainer,
      },
    },
  }));
};

const canEditSession = async (user, trainerId, subjectId, { scheduleId, date } = {}) => {
  if (isAuthorizedRole(user?.role, FULL_ACCESS_ROLES)) return true;
  if (await isAssignedReplacementForDate(user, scheduleId, date)) return true;
  // Coordinators who also teach (e.g. Sai Priya / PSTJ) can edit their own classes.
  if (user?.trainer && user.trainer.toString() === trainerId?.toString()) return true;
  if (isSubjectCoordinator(user)) {
    const subjectIds = getCoordinatorSubjectIds(user);
    if (!subjectIds.includes(subjectId?.toString())) return false;
    return coordinatorCanAccessTrainer(user, trainerId);
  }
  if (user?.role === ROLES.TRAINER) {
    return user.trainer?.toString() === trainerId?.toString();
  }
  return false;
};

const resolveScheduleContext = async (scheduleId) => {
  const schedule = await Schedule.findById(scheduleId)
    .populate('subject', 'name code topics')
    .populate('venue', 'name building floor')
    .lean();
  if (!schedule) return null;

  const trainer = await findTrainerByScheduleCode(Trainer, schedule.trainerCode);
  if (!trainer) return null;

  return { schedule, trainer };
};

export const getTopicTrackerOverview = async (req, res) => {
  if (!isAuthorizedRole(req.user.role, MANAGEMENT_VIEW_ROLES)) {
    return res.status(403).json({ message: 'Not authorized to view topic tracker overview' });
  }

  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const overview = await buildTopicTrackerOverview({ date, user: req.user });
  res.json(overview);
};

export const getTopicTrackerSessions = async (req, res) => {
  const { date, subjectId, trainerId } = req.query;
  if (!date) {
    return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });
  }

  const payload = await buildTopicTrackerSessions({
    date,
    subjectId,
    trainerId,
    user: req.user,
  });

  res.json(payload);
};

export const getTopicTrackerTopics = async (req, res) => {
  const { subjectCode, subjectId } = req.query;
  if (!subjectCode && !subjectId) {
    return res.status(400).json({ message: 'subjectCode or subjectId is required' });
  }

  const subject = subjectId
    ? await Subject.findById(subjectId).select('code topics').lean()
    : await Subject.findOne({ code: subjectCode }).select('code topics').lean();

  const topics = getTopicOptionsForSubjectDoc(subject) || [];
  const code = subject?.code || subjectCode || '';
  res.json({
    subjectCode: code,
    topics,
    restricted: topics.length > 0,
  });
};

export const getTopicTrackerClassSummary = async (req, res) => {
  const isTrainerUser = req.user.role === ROLES.TRAINER;
  const isManagement = isAuthorizedRole(req.user.role, MANAGEMENT_VIEW_ROLES);

  if (!isTrainerUser && !isManagement) {
    return res.status(403).json({ message: 'Not authorized to view class-wise summary' });
  }

  const { subjectId, mine } = req.query;
  const ownTrainerId = req.user.trainer
    ? String(req.user.trainer._id || req.user.trainer)
    : '';

  // Trainers always see only their classes. Coordinators/admins can pass mine=true for own teaching summary.
  let trainerId;
  if (isTrainerUser) {
    if (!ownTrainerId) {
      return res.json({ subjects: [] });
    }
    trainerId = ownTrainerId;
  } else if (mine === 'true' || mine === '1') {
    if (!ownTrainerId) {
      return res.json({ subjects: [] });
    }
    trainerId = ownTrainerId;
  }

  if (isSubjectCoordinator(req.user) && subjectId && !trainerId) {
    const allowed = getCoordinatorSubjectIds(req.user);
    if (!allowed.includes(subjectId.toString())) {
      return res.status(403).json({ message: 'Not authorized for this subject' });
    }
  }

  const summary = await buildTopicTrackerClassSummary({
    subjectId: subjectId || undefined,
    user: req.user,
    trainerId,
  });
  res.json(summary);
};

export const upsertTopicTrackerEntry = async (req, res) => {
  const {
    scheduleId,
    date,
    topicModuleCovered,
    sessionStartTime,
    sessionEndTime,
    allottedStudents,
    noPresent,
    sessionStatus,
    keyObservationsFeedback,
    challengesFaced,
    trackerStatus,
    branchYearSection,
    roomNo,
    courseName,
    trainerName,
  } = req.body;

  if (!scheduleId || !date) {
    return res.status(400).json({ message: 'scheduleId and date are required' });
  }

  const context = await resolveScheduleContext(scheduleId);
  if (!context) {
    return res.status(404).json({ message: 'Schedule or trainer not found' });
  }

  const { schedule, trainer } = context;
  const subjectId = schedule.subject?._id || schedule.subject;
  const allowed = await canEditSession(req.user, trainer._id, subjectId, {
    scheduleId,
    date,
  });
  if (!allowed) {
    return res.status(403).json({ message: 'Not authorized to update this topic tracker entry' });
  }

  const refDate = normalizeDate(date);
  const startTime = sessionStartTime || schedule.startTime;
  const endTime = sessionEndTime || schedule.endTime;
  const allotted = allottedStudents ?? 0;
  const present = noPresent ?? 0;

  let nextStatus = trackerStatus;
  if (nextStatus && !TOPIC_TRACKER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ message: 'Invalid tracker status' });
  }

  const existing = await TopicTrackerEntry.findOne({ schedule: scheduleId, date: refDate });
  const subjectCode = schedule.subject?.code || schedule.subjectCode || '';
  const resolvedTopic = topicModuleCovered ?? existing?.topicModuleCovered ?? '';

  if (resolvedTopic && !isAllowedTopicForSubject(subjectCode, resolvedTopic, schedule.subject?.topics)) {
    return res.status(400).json({
      message: 'Select a topic from the approved list for this subject.',
    });
  }

  const resolvedSessionStatus = sessionStatus ?? existing?.sessionStatus ?? '';
  if (resolvedSessionStatus && !SESSION_STATUS_VALUES.includes(resolvedSessionStatus)) {
    return res.status(400).json({
      message: 'Session status must be completed, cancelled, or postponed.',
    });
  }

  if (nextStatus === 'closed' && !resolvedSessionStatus) {
    return res.status(400).json({
      message: 'Select a session status before marking this slot as closed.',
    });
  }

  const payload = {
    date: refDate,
    schedule: scheduleId,
    trainer: trainer._id,
    subject: subjectId,
    day: schedule.day,
    slot: schedule.slot || '',
    trainerName: trainerName || trainer.name,
    branchYearSection: branchYearSection || `${schedule.department}, Sem ${schedule.semester} - ${schedule.section}`,
    roomNo: roomNo || schedule.venue?.name || '',
    courseName: courseName || schedule.subject?.name || schedule.subjectCode || '',
    topicModuleCovered: resolvedTopic,
    sessionStartTime: startTime,
    sessionEndTime: endTime,
    durationHrs: computeHours(startTime, endTime),
    allottedStudents: allotted,
    noPresent: present,
    attendancePercent: computeAttendancePercent(allotted, present),
    sessionStatus: resolvedSessionStatus,
    keyObservationsFeedback: keyObservationsFeedback ?? existing?.keyObservationsFeedback ?? '',
    challengesFaced: challengesFaced ?? existing?.challengesFaced ?? '',
    markedBy: req.user._id,
  };

  if (nextStatus) {
    payload.trackerStatus = nextStatus;
    if (nextStatus === 'closed') {
      payload.closedAt = new Date();
      payload.closedBy = req.user._id;
    } else {
      payload.closedAt = null;
      payload.closedBy = null;
    }
  } else {
    payload.trackerStatus = existing?.trackerStatus || 'pending';
  }

  const entry = await TopicTrackerEntry.findOneAndUpdate(
    { schedule: scheduleId, date: refDate },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await notifyAdminsOfTopicTrackerUpdate(entry, req.user);
  res.json(entry);
};

export const updateTopicTrackerStatus = async (req, res) => {
  const { status } = req.body;
  if (!TOPIC_TRACKER_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid tracker status' });
  }

  const entry = await TopicTrackerEntry.findById(req.params.id);
  if (!entry) {
    return res.status(404).json({ message: 'Topic tracker entry not found' });
  }

  const allowed = await canEditSession(req.user, entry.trainer, entry.subject, {
    scheduleId: entry.schedule,
    date: entry.date,
  });
  if (!allowed) {
    return res.status(403).json({ message: 'Not authorized to update this entry' });
  }

  entry.trackerStatus = status;
  if (status === 'closed') {
    entry.closedAt = new Date();
    entry.closedBy = req.user._id;
  } else {
    entry.closedAt = null;
    entry.closedBy = null;
  }
  entry.markedBy = req.user._id;
  await entry.save();

  await notifyAdminsOfTopicTrackerUpdate(entry, req.user);
  res.json(entry);
};

export const exportTopicTrackerForSheets = async (req, res) => {
  const payload = await buildTopicTrackerExportRows();
  res.json(payload);
};
