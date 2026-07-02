import Subject from '../models/Subject.js';
import Semester from '../models/Semester.js';
import Department from '../models/Department.js';
import School from '../models/School.js';
import Trainer from '../models/Trainer.js';
import { normalizeSlotTimings, DEFAULT_SLOT_TIMINGS } from '../utils/timetableSlots.js';
import {
  applySubjectTrainerEligibleChange,
} from '../utils/syncTrainerSubjectLinks.js';

const populateSubject = (query) =>
  query
    .populate('schools', 'name code')
    .populate('semester', 'name number')
    .populate('departments', 'name code')
    .populate('trainerEligible', 'name employeeId');

const toIdList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((id) => id.trim()).filter(Boolean);
  }
  return [value];
};

const normalizeSubjectPayload = (body) => {
  const payload = { ...body };
  const allDepartments = payload.allDepartments === true || payload.allDepartments === 'true';

  payload.schools = toIdList(payload.schools?.length ? payload.schools : payload.school);
  payload.departments = allDepartments ? [] : toIdList(payload.departments?.length ? payload.departments : payload.department);
  payload.allDepartments = allDepartments;

  delete payload.school;
  delete payload.department;
  delete payload.course;

  if (payload.slotTimings !== undefined) {
    payload.slotTimings = normalizeSlotTimings(payload.slotTimings);
  }

  return payload;
};

export const migrateSubjectSlotTimings = async () => {
  await Subject.updateMany(
    {
      $or: [
        { 'slotTimings.s1': { $exists: false } },
        { 'slotTimings.s2': { $exists: false } },
        { 'slotTimings.s3': { $exists: false } },
      ],
    },
    {
      $set: {
        slotTimings: DEFAULT_SLOT_TIMINGS,
      },
    }
  );
};

export const migrateSubjectSchoolsAndDepartments = async () => {
  const legacySubjects = await Subject.collection
    .find({
      $or: [
        { school: { $exists: true, $ne: null } },
        { department: { $exists: true, $ne: null } },
        { course: { $exists: true, $ne: null } },
      ],
    })
    .toArray();

  for (const raw of legacySubjects) {
    const update = {};
    if (raw.school && (!raw.schools || raw.schools.length === 0)) {
      update.schools = [raw.school];
    }
    if (raw.department && (!raw.departments || raw.departments.length === 0) && !raw.allDepartments) {
      update.departments = [raw.department];
    }

    await Subject.collection.updateOne(
      { _id: raw._id },
      {
        ...(Object.keys(update).length ? { $set: update } : {}),
        $unset: { school: '', department: '', course: '' },
      }
    );
  }
};

const buildSubjectQuery = async (query) => {
  const filter = {};
  if (query.semester) filter.semester = query.semester;
  if (query.school) filter.schools = query.school;
  if (query.department) filter.departments = query.department;
  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$or = [{ name: searchRegex }, { code: searchRegex }];
  }
  if (query.trainer) {
    const trainer = await Trainer.findById(query.trainer).select('subjects');
    const subjectIds = trainer?.subjects?.map((id) => id.toString()) || [];
    const trainerClauses = [{ trainerEligible: query.trainer }];
    if (subjectIds.length) {
      trainerClauses.push({ _id: { $in: subjectIds } });
    }
    filter.$or = filter.$or
      ? [{ $and: [{ $or: filter.$or }, { $or: trainerClauses }] }]
      : trainerClauses;
  }
  return filter;
};

export const getSubjects = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = await buildSubjectQuery(req.query);
  const sortField = ['name', 'code', 'hours', 'createdAt'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'name';
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

  const [subjects, total] = await Promise.all([
    populateSubject(Subject.find(filter))
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit),
    Subject.countDocuments(filter),
  ]);

  res.json({
    subjects,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getSubjectById = async (req, res) => {
  const subject = await populateSubject(Subject.findById(req.params.id));
  if (!subject) return res.status(404).json({ message: 'Subject not found' });
  res.json(subject);
};

export const createSubject = async (req, res) => {
  const existing = await Subject.findOne({ code: req.body.code });
  if (existing) {
    return res.status(400).json({ message: 'Subject code already exists' });
  }

  const subject = await Subject.create(normalizeSubjectPayload(req.body));
  await applySubjectTrainerEligibleChange(subject._id, [], subject.trainerEligible);
  const populated = await populateSubject(Subject.findById(subject._id));

  res.status(201).json(populated);
};

export const updateSubject = async (req, res) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) return res.status(404).json({ message: 'Subject not found' });

  if (req.body.code) {
    const conflict = await Subject.findOne({
      _id: { $ne: req.params.id },
      code: req.body.code,
    });
    if (conflict) {
      return res.status(400).json({ message: 'Subject code already exists' });
    }
  }

  const previousEligible = [...(subject.trainerEligible || [])];
  const payload = normalizeSubjectPayload(req.body);
  Object.assign(subject, payload);
  await subject.save();

  await applySubjectTrainerEligibleChange(
    subject._id,
    previousEligible,
    subject.trainerEligible
  );

  const updated = await populateSubject(Subject.findById(subject._id));
  res.json(updated);
};

export const deleteSubject = async (req, res) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) return res.status(404).json({ message: 'Subject not found' });
  await subject.deleteOne();
  res.json({ message: 'Subject removed' });
};

export const getSchools = async (req, res) => {
  const schools = await School.find().sort({ code: 1 });
  res.json(schools);
};

export const getSemesters = async (req, res) => {
  const semesters = await Semester.find()
    .populate('academicYear', 'name')
    .sort({ number: 1 });
  res.json(semesters);
};

export const getDepartments = async (req, res) => {
  const filter = {};
  const schoolIds = toIdList(req.query.schools || req.query.school);
  if (schoolIds.length > 0) {
    filter.school = { $in: schoolIds };
  }

  const departments = await Department.find(filter)
    .populate('school', 'name code')
    .sort({ name: 1 });
  res.json(departments);
};
