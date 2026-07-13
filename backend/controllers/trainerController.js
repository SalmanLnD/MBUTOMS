import Trainer from '../models/Trainer.js';
import Department from '../models/Department.js';
import Subject from '../models/Subject.js';
import Schedule from '../models/Schedule.js';
import { applyTrainerSubjectsChange, toIdStrings } from '../utils/syncTrainerSubjectLinks.js';
import { syncTrainerUser, removeTrainerUser } from '../utils/trainerUserSync.js';
import { INITIAL_TRAINER_PASSWORD } from '../constants/trainerAuth.js';
import { mergeRosterFilter, shouldApplyRosterFilter } from '../utils/rosterFilter.js';
import {
  buildTrainerFilterForCoordinatorSubjects,
  coordinatorCanAccessTrainer,
  getCoordinatorSubjectIds,
  isSubjectCoordinator,
} from '../utils/subjectCoordinatorAccess.js';

const buildTrainerQuery = async (query) => {
  const clauses = [];

  if (query.department) {
    clauses.push({ department: query.department });
  }

  if (query.search?.trim()) {
    const searchRegex = { $regex: query.search.trim(), $options: 'i' };
    clauses.push({
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { employeeId: searchRegex },
        { phone: searchRegex },
      ],
    });
  }

  if (query.subject?.trim()) {
    const subjectRegex = { $regex: query.subject.trim(), $options: 'i' };
    const matchingSubjects = await Subject.find({
      $or: [{ name: subjectRegex }, { code: subjectRegex }],
    }).select('_id trainerEligible');

    if (!matchingSubjects.length) {
      clauses.push({ _id: { $in: [] } });
    } else {
      const subjectIds = matchingSubjects.map((subject) => subject._id);
      const eligibleTrainerIds = [
        ...new Set(
          matchingSubjects.flatMap((subject) =>
            (subject.trainerEligible || []).map((trainerId) => trainerId.toString())
          )
        ),
      ];

      const subjectClauses = [{ subjects: { $in: subjectIds } }];
      if (eligibleTrainerIds.length) {
        subjectClauses.push({ _id: { $in: eligibleTrainerIds } });
      }
      clauses.push({ $or: subjectClauses });
    }
  }

  if (query.status?.trim()) {
    clauses.push({ status: query.status.trim() });
  }

  if (!clauses.length) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
};

const getSortOption = (sortBy, sortOrder) => {
  const allowed = ['name', 'employeeId', 'joiningDate', 'experience', 'createdAt'];
  const field = allowed.includes(sortBy) ? sortBy : 'employeeId';
  const direction = sortOrder === 'asc' ? 1 : -1;
  return { [field]: direction, _id: 1 };
};

export const getTrainers = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = await buildTrainerQuery(req.query);
  const rosterOnly = shouldApplyRosterFilter(req.query);
  let finalFilter = await mergeRosterFilter(filter, { rosterOnly });

  if (isSubjectCoordinator(req.user)) {
    const coordinatorSubjectIds = getCoordinatorSubjectIds(req.user);
    const coordinatorFilter = await buildTrainerFilterForCoordinatorSubjects(coordinatorSubjectIds);
    finalFilter = Object.keys(finalFilter).length
      ? { $and: [finalFilter, coordinatorFilter] }
      : coordinatorFilter;
  }
  const sort = getSortOption(req.query.sortBy, req.query.sortOrder);

  const [trainers, total] = await Promise.all([
    Trainer.find(finalFilter)
      .populate('department', 'name code')
      .populate('subjects', 'name code slotCount slotTimings')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Trainer.countDocuments(finalFilter),
  ]);

  res.json({
    trainers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

const mergeTrainerSubjects = async (trainer) => {
  const eligibleSubjects = await Subject.find({ trainerEligible: trainer._id }).select('name code hours');
  const subjectMap = new Map();

  (trainer.subjects || []).forEach((subject) => {
    subjectMap.set(subject._id.toString(), subject);
  });
  eligibleSubjects.forEach((subject) => {
    subjectMap.set(subject._id.toString(), subject);
  });

  const plain = trainer.toObject ? trainer.toObject() : { ...trainer };
  plain.subjects = [...subjectMap.values()];
  return plain;
};

export const getTrainerById = async (req, res) => {
  const trainer = await Trainer.findById(req.params.id)
    .populate('department', 'name code')
    .populate('subjects', 'name code hours');

  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  if (isSubjectCoordinator(req.user)) {
    const allowed = await coordinatorCanAccessTrainer(req.user, trainer._id);
    if (!allowed) {
      return res.status(403).json({ message: 'Not authorized to view this trainer' });
    }
  }

  res.json(await mergeTrainerSubjects(trainer));
};

const sanitizeTrainerBody = (body) => {
  const payload = { ...body };
  if (!payload.email?.trim()) {
    delete payload.email;
  } else {
    payload.email = payload.email.trim().toLowerCase();
  }
  if (!payload.phone?.trim()) {
    payload.phone = '';
  } else {
    payload.phone = payload.phone.trim();
  }
  if (payload.camuErpId !== undefined) {
    payload.camuErpId = payload.camuErpId?.trim() || '';
  }
  if (payload.camuPassword !== undefined) {
    payload.camuPassword = payload.camuPassword?.trim() || '';
  }
  if (payload.subjects !== undefined) {
    payload.subjects = toIdStrings(payload.subjects);
  }
  return payload;
};

export const createTrainer = async (req, res) => {
  const payload = sanitizeTrainerBody(req.body);
  const conflictQuery = [{ employeeId: payload.employeeId }];
  if (payload.email) conflictQuery.push({ email: payload.email });

  const existing = await Trainer.findOne({ $or: conflictQuery });
  if (existing) {
    return res.status(400).json({ message: 'Trainer with this employee ID or email already exists' });
  }

  const { email, ...trainerData } = payload;
  const trainer = await Trainer.create(trainerData);

  if (email) {
    trainer.email = email;
    await trainer.save();
  }

  if (trainer.subjects?.length) {
    await applyTrainerSubjectsChange(trainer._id, [], trainer.subjects);
  }

  const populated = await Trainer.findById(trainer._id)
    .populate('department', 'name code')
    .populate('subjects', 'name code');

  if (email) {
    await syncTrainerUser(populated, { resetPassword: true });
  }

  res.status(201).json(populated);
};

export const updateTrainer = async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  const payload = sanitizeTrainerBody(req.body);

  if (payload.employeeId || payload.email) {
    const conflict = await Trainer.findOne({
      _id: { $ne: req.params.id },
      $or: [
        ...(payload.employeeId ? [{ employeeId: payload.employeeId }] : []),
        ...(payload.email ? [{ email: payload.email }] : []),
      ],
    });
    if (conflict) {
      return res.status(400).json({ message: 'Employee ID or email already in use' });
    }
  }

  const previousSubjects = [...(trainer.subjects || [])];
  const previousEmployeeId = trainer.employeeId;

  const updateDoc = { $set: { ...payload } };
  if (!req.body.email?.trim()) {
    delete updateDoc.$set.email;
    updateDoc.$unset = { email: '' };
  }

  const updated = await Trainer.findByIdAndUpdate(req.params.id, updateDoc, {
    new: true,
    runValidators: true,
  })
    .populate('department', 'name code')
    .populate('subjects', 'name code');

  if (payload.subjects !== undefined) {
    await applyTrainerSubjectsChange(req.params.id, previousSubjects, payload.subjects);
  }

  if (payload.employeeId && payload.employeeId !== previousEmployeeId) {
    const legacyCodes = [];
    const hasOldSchedules = await Schedule.exists({ trainerCode: previousEmployeeId });
    if (hasOldSchedules) legacyCodes.push(previousEmployeeId);

    if (legacyCodes.length) {
      await Trainer.updateOne(
        { _id: req.params.id },
        { $addToSet: { scheduleTrainerCodes: { $each: legacyCodes } } }
      );
    }
  }

  const refreshed = await Trainer.findById(req.params.id)
    .populate('department', 'name code')
    .populate('subjects', 'name code');

  if (payload.email) {
    await syncTrainerUser(refreshed);
  } else if (!req.body.email?.trim()) {
    await removeTrainerUser(req.params.id);
  }

  res.json(refreshed);
};

export const deleteTrainer = async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }
  await removeTrainerUser(trainer._id);
  await trainer.deleteOne();
  res.json({ message: 'Trainer removed' });
};

export const resetTrainerPassword = async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }
  if (!trainer.email?.trim()) {
    return res.status(400).json({ message: 'Trainer does not have an email address for login' });
  }

  await syncTrainerUser(trainer, { resetPassword: true });

  res.json({
    message: `Password reset to initial OTP (${INITIAL_TRAINER_PASSWORD}). Trainer must set a new password on next login.`,
    email: trainer.email.trim().toLowerCase(),
  });
};

export const getDepartments = async (req, res) => {
  const departments = await Department.find().sort({ name: 1 });
  res.json(departments);
};
