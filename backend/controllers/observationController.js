import Trainer from '../models/Trainer.js';
import Schedule from '../models/Schedule.js';
import TrainerObservation, { OBSERVATION_TYPES } from '../models/TrainerObservation.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';
import {
  PERFORMANCE_EXCLUDED_EMPLOYEE_IDS,
  resolveTrainerScheduleCodes,
} from '../utils/trainerMappings.js';
import {
  buildObservationClassDetail,
  notifyTrainerOfObservationComments,
} from '../utils/observationNotifications.js';
import {
  buildTrainerFilterForEvaluator,
  evaluatorCanRateTrainer,
  getEvaluatorSubjectCodes,
  hasFullObservationAccess,
} from '../utils/evaluatorAccess.js';

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const DAY_ORDER = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const isValidMonthKey = (value) => MONTH_KEY_PATTERN.test(String(value || '').trim());

const normalizeType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  return OBSERVATION_TYPES.includes(type) ? type : null;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

const serializeClassFields = (observation = {}) => ({
  scheduleId: observation.schedule?.toString?.() || observation.schedule || null,
  department: observation.department || '',
  section: observation.section || '',
  slot: observation.slot || '',
  startTime: observation.startTime || '',
  endTime: observation.endTime || '',
  day: observation.day || '',
  subjectCode: observation.subjectCode || '',
  observationDate: observation.observationDate || '',
  observationTime: observation.observationTime || '',
  classDetail: buildObservationClassDetail(observation),
});

const emptyClassFields = () => ({
  schedule: null,
  department: '',
  section: '',
  slot: '',
  startTime: '',
  endTime: '',
  day: '',
  subjectCode: '',
  observationDate: '',
  observationTime: '',
});

const normalizeObservationDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!DATE_KEY_PATTERN.test(raw)) {
    const error = new Error('observationDate must be YYYY-MM-DD');
    error.statusCode = 400;
    throw error;
  }
  return raw;
};

const normalizeObservationTime = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(TIME_KEY_PATTERN);
  if (!match) {
    const error = new Error('observationTime must be HH:MM');
    error.statusCode = 400;
    throw error;
  }
  return `${match[1]}:${match[2]}`;
};

const scheduleOptionLabel = (schedule) => {
  const className = [schedule.department, schedule.section].filter(Boolean).join(' ');
  const time = [schedule.startTime, schedule.endTime].filter(Boolean).join('–');
  return [
    schedule.day,
    schedule.slot,
    schedule.subjectCode,
    className,
    time,
  ].filter(Boolean).join(' · ');
};

const buildScheduleOptionsByTrainer = async (trainers) => {
  const codeToTrainerIds = new Map();
  trainers.forEach((trainer) => {
    resolveTrainerScheduleCodes(trainer).forEach((code) => {
      if (!codeToTrainerIds.has(code)) codeToTrainerIds.set(code, []);
      codeToTrainerIds.get(code).push(trainer._id.toString());
    });
  });

  const codes = [...codeToTrainerIds.keys()];
  if (!codes.length) {
    return Object.fromEntries(trainers.map((trainer) => [trainer._id.toString(), []]));
  }

  const schedules = await Schedule.find({ trainerCode: { $in: codes } })
    .select('_id trainerCode day slot startTime endTime department section subjectCode')
    .lean();

  const byTrainer = Object.fromEntries(trainers.map((trainer) => [trainer._id.toString(), []]));
  const seen = new Map();

  schedules
    .sort((a, b) =>
      (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99)
      || String(a.startTime || '').localeCompare(String(b.startTime || ''))
    )
    .forEach((schedule) => {
      const trainerIds = codeToTrainerIds.get(schedule.trainerCode) || [];
      trainerIds.forEach((trainerId) => {
        const key = `${trainerId}:${schedule._id}`;
        if (seen.has(key)) return;
        seen.set(key, true);
        byTrainer[trainerId].push({
          scheduleId: schedule._id,
          label: scheduleOptionLabel(schedule),
          department: schedule.department || '',
          section: schedule.section || '',
          slot: schedule.slot || '',
          startTime: schedule.startTime || '',
          endTime: schedule.endTime || '',
          day: schedule.day || '',
          subjectCode: schedule.subjectCode || '',
        });
      });
    });

  return byTrainer;
};

const resolveClassFields = async ({ type, scheduleId, body }) => {
  const observationDate = normalizeObservationDate(body.observationDate);
  const observationTime = normalizeObservationTime(body.observationTime);

  // Demo observations carry no class context, but need date/time so PLP can
  // place them in the right 21–20 cycle.
  if (type !== 'class') {
    return {
      ...emptyClassFields(),
      observationDate,
      observationTime,
    };
  }

  if (scheduleId) {
    const schedule = await Schedule.findById(scheduleId)
      .select('_id day slot startTime endTime department section subjectCode')
      .lean();
    if (!schedule) {
      const error = new Error('Schedule not found');
      error.statusCode = 404;
      throw error;
    }
    return {
      schedule: schedule._id,
      department: schedule.department || '',
      section: schedule.section || '',
      slot: schedule.slot || '',
      startTime: schedule.startTime || '',
      endTime: schedule.endTime || '',
      day: schedule.day || '',
      subjectCode: schedule.subjectCode || '',
      observationDate,
      observationTime,
    };
  }

  return {
    schedule: null,
    department: String(body.department || '').trim(),
    section: String(body.section || '').trim(),
    slot: String(body.slot || '').trim(),
    startTime: String(body.startTime || '').trim(),
    endTime: String(body.endTime || '').trim(),
    day: String(body.day || '').trim(),
    subjectCode: String(body.subjectCode || '').trim(),
    observationDate,
    observationTime,
  };
};

export const getObservations = async (req, res) => {
  const monthKey = String(req.query.month || '').trim();
  const type = normalizeType(req.query.type);

  if (!isValidMonthKey(monthKey)) {
    return res.status(400).json({ message: 'Valid month (YYYY-MM) is required' });
  }
  if (!type) {
    return res.status(400).json({ message: 'type must be demo or class' });
  }

  const scoped = !hasFullObservationAccess(req.user);
  const evaluatorFilter = scoped ? await buildTrainerFilterForEvaluator(req.user) : null;
  const allowedSubjectCodes = scoped
    ? new Set(await getEvaluatorSubjectCodes(req.user))
    : null;

  const rosterFilter = await mergeRosterFilter(
    {
      status: 'active',
      employeeId: { $nin: PERFORMANCE_EXCLUDED_EMPLOYEE_IDS },
      ...(evaluatorFilter || {}),
    },
    { rosterOnly: true }
  );
  const trainers = await Trainer.find(rosterFilter)
    .select('name employeeId scheduleTrainerCodes')
    .sort({ employeeId: 1 })
    .lean();

  const trainerIds = trainers.map((trainer) => trainer._id);
  const [observations, scheduleOptionsByTrainer] = await Promise.all([
    TrainerObservation.find({
      monthKey,
      type,
      ...(trainerIds.length ? { trainer: { $in: trainerIds } } : { trainer: { $in: [] } }),
    })
      .select('trainer rating comments schedule department section slot startTime endTime day subjectCode observationDate observationTime updatedAt ratedBy')
      .lean(),
    type === 'class' ? buildScheduleOptionsByTrainer(trainers) : Promise.resolve({}),
  ]);

  const byTrainer = new Map(
    observations.map((row) => [row.trainer.toString(), row])
  );

  res.json({
    monthKey,
    type,
    trainers: trainers.map((trainer) => {
      const observation = byTrainer.get(trainer._id.toString());
      let scheduleOptions = scheduleOptionsByTrainer[trainer._id.toString()] || [];
      if (allowedSubjectCodes) {
        scheduleOptions = scheduleOptions.filter(
          (option) => !option.subjectCode || allowedSubjectCodes.has(option.subjectCode)
        );
      }
      return {
        trainerId: trainer._id,
        employeeId: trainer.employeeId,
        name: trainer.name,
        rating: observation?.rating ?? null,
        comments: observation?.comments || '',
        updatedAt: observation?.updatedAt || null,
        ...serializeClassFields(observation),
        scheduleOptions,
      };
    }),
  });
};

export const upsertObservation = async (req, res) => {
  const trainerId = req.params.trainerId;
  const monthKey = String(req.body.monthKey || '').trim();
  const type = normalizeType(req.body.type);
  const comments = String(req.body.comments || '').trim();
  const scheduleId = req.body.scheduleId || null;

  if (!isValidMonthKey(monthKey)) {
    return res.status(400).json({ message: 'Valid monthKey (YYYY-MM) is required' });
  }
  if (!type) {
    return res.status(400).json({ message: 'type must be demo or class' });
  }

  const trainer = await Trainer.findById(trainerId).select('_id name employeeId');
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  if (!hasFullObservationAccess(req.user)) {
    const allowed = await evaluatorCanRateTrainer(req.user, trainerId);
    if (!allowed) {
      return res.status(403).json({ message: 'Not authorized to rate this trainer' });
    }
  }

  let rating = req.body.rating;
  if (rating === '' || rating === undefined || rating === null) {
    rating = null;
  } else {
    rating = Number(rating);
    if (!Number.isFinite(rating) || rating < 0.5 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 0.5 and 5' });
    }
    // Snap to the nearest 0.5 step (0.5, 1, 1.5 … 5).
    rating = Math.round(rating * 2) / 2;
  }

  let classFields;
  try {
    classFields = await resolveClassFields({ type, scheduleId, body: req.body });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message });
  }

  if (type === 'class' && !classFields.schedule && !classFields.department && !classFields.section) {
    return res.status(400).json({ message: 'Select the class and slot for this class observation' });
  }

  if ((rating != null || comments) && !classFields.observationDate) {
    return res.status(400).json({ message: 'Observation date is required' });
  }

  const previous = await TrainerObservation.findOne({ trainer: trainerId, monthKey, type })
    .select('comments')
    .lean();
  const previousComments = String(previous?.comments || '').trim();

  if (rating == null && !comments && type === 'demo') {
    await TrainerObservation.deleteOne({ trainer: trainerId, monthKey, type });
    return res.json({
      trainerId: trainer._id,
      employeeId: trainer.employeeId,
      name: trainer.name,
      rating: null,
      comments: '',
      updatedAt: null,
      ...serializeClassFields(),
    });
  }

  if (rating == null && !comments && type === 'class' && !classFields.schedule) {
    await TrainerObservation.deleteOne({ trainer: trainerId, monthKey, type });
    return res.json({
      trainerId: trainer._id,
      employeeId: trainer.employeeId,
      name: trainer.name,
      rating: null,
      comments: '',
      updatedAt: null,
      ...serializeClassFields(),
    });
  }

  const observation = await TrainerObservation.findOneAndUpdate(
    { trainer: trainerId, monthKey, type },
    {
      $set: {
        rating,
        comments,
        ratedBy: req.user?._id || null,
        ...classFields,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (comments && comments !== previousComments) {
    try {
      await notifyTrainerOfObservationComments({
        actor: req.user,
        trainer,
        type,
        comments,
        monthKey,
        classDetail: buildObservationClassDetail({
          ...classFields,
          observationDate: classFields.observationDate,
          observationTime: classFields.observationTime,
        }),
      });
    } catch (err) {
      console.error('Failed to send observation notifications:', err.message);
    }
  }

  res.json({
    trainerId: trainer._id,
    employeeId: trainer.employeeId,
    name: trainer.name,
    rating: observation.rating,
    comments: observation.comments || '',
    updatedAt: observation.updatedAt,
    ...serializeClassFields(observation),
  });
};
