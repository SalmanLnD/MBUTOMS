import Trainer from '../models/Trainer.js';
import Department from '../models/Department.js';
import Subject from '../models/Subject.js';
import { applyTrainerSubjectsChange } from '../utils/syncTrainerSubjectLinks.js';

const buildTrainerQuery = (query) => {
  const filter = {};
  if (query.department) filter.department = query.department;
  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { employeeId: searchRegex },
      { phone: searchRegex },
    ];
  }
  return filter;
};

const getSortOption = (sortBy, sortOrder) => {
  const allowed = ['name', 'employeeId', 'joiningDate', 'experience', 'createdAt'];
  const field = allowed.includes(sortBy) ? sortBy : 'employeeId';
  const direction = sortOrder === 'asc' ? 1 : -1;
  return { [field]: direction, _id: 1 };
};

export const getTrainers = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = buildTrainerQuery(req.query);
  const sort = getSortOption(req.query.sortBy, req.query.sortOrder);

  const [trainers, total] = await Promise.all([
    Trainer.find(filter)
      .populate('department', 'name code')
      .populate('subjects', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Trainer.countDocuments(filter),
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
    await applyTrainerSubjectsChange(req.params.id, previousSubjects, updated.subjects);
  }

  const refreshed = await Trainer.findById(req.params.id)
    .populate('department', 'name code')
    .populate('subjects', 'name code');

  res.json(refreshed);
};

export const deleteTrainer = async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }
  await trainer.deleteOne();
  res.json({ message: 'Trainer removed' });
};

export const getDepartments = async (req, res) => {
  const departments = await Department.find().sort({ name: 1 });
  res.json(departments);
};
