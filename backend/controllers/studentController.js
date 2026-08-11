import Student from '../models/Student.js';
import Department from '../models/Department.js';
// Register related models so populate() works on serverless cold starts.
import '../models/Batch.js';
import '../models/Section.js';
import '../models/Semester.js';
import {
  buildStudentBulkTemplateBuffer,
  BULK_IMPORT_BATCH_SIZE,
  importStudentsFromRows,
  importValidatedStudentRows,
  parseStudentBulkFile,
  validateStudentBulkRows,
} from '../utils/studentBulkImport.js';
import { expandAllowedClassDepartments } from '../utils/subjectClassEligibility.js';
import {
  canAccessStudentRecord,
  mergeWithStudentAccessFilter,
} from '../utils/trainerClassAccess.js';
import { invalidateStudentCountCache } from './classController.js';

const populateStudent = (query) =>
  query
    .populate('batch', 'name')
    .populate('section', 'name')
    .populate('semester', 'name number');

const buildStudentQuery = async (query) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.batch) filter.batch = query.batch;
  if (query.section) filter.sectionLabel = query.section;

  if (query.department) {
    filter.branch = query.department;
  } else if (query.school) {
    const departments = await Department.find({ school: query.school })
      .select('code')
      .lean();
    const codes = expandAllowedClassDepartments(
      departments.map((department) => department.code)
    );
    filter.branch = { $in: codes.length ? codes : ['__none__'] };
  }

  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$or = [
      { name: searchRegex },
      { rollNumber: searchRegex },
      { email: searchRegex },
      { branch: searchRegex },
      { sectionLabel: searchRegex },
    ];
  }
  return filter;
};

export const getStudents = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const baseFilter = await buildStudentQuery(req.query);
  const filter = await mergeWithStudentAccessFilter(baseFilter, req.user, req);

  if (filter._id === null) {
    return res.json({
      students: [],
      pagination: { page: 1, limit, total: 0, pages: 0 },
    });
  }

  const sortField = ['name', 'rollNumber', 'branch', 'createdAt'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'name';
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

  const [students, total] = await Promise.all([
    Student.find(filter)
      .select('rollNumber name email branch sectionLabel semesterLabel py status batch section semester createdAt')
      .sort({ [sortField]: sortOrder, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Student.countDocuments(filter),
  ]);

  res.json({
    students,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getStudentById = async (req, res) => {
  const student = await populateStudent(Student.findById(req.params.id));
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const hasAccess = await canAccessStudentRecord(req.user, student, req);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Not authorized to view this student' });
  }

  res.json(student);
};

export const createStudent = async (req, res) => {
  const existing = await Student.findOne({ rollNumber: req.body.rollNumber });
  if (existing) {
    return res.status(400).json({ message: 'Roll number already exists' });
  }

  const student = await Student.create(req.body);
  invalidateStudentCountCache();
  const populated = await populateStudent(Student.findById(student._id));
  res.status(201).json(populated);
};

export const updateStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  if (req.body.rollNumber) {
    const conflict = await Student.findOne({
      _id: { $ne: req.params.id },
      rollNumber: req.body.rollNumber,
    });
    if (conflict) {
      return res.status(400).json({ message: 'Roll number already exists' });
    }
  }

  Object.assign(student, req.body);
  await student.save();
  invalidateStudentCountCache();
  const updated = await populateStudent(Student.findById(student._id));
  res.json(updated);
};

export const deleteStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  await student.deleteOne();
  invalidateStudentCountCache();
  res.json({ message: 'Student removed' });
};

export const downloadStudentBulkTemplate = async (_req, res) => {
  const buffer = await buildStudentBulkTemplateBuffer();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="student-bulk-upload-template.xlsx"'
  );
  res.send(Buffer.from(buffer));
};

export const bulkUploadStudents = async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ message: 'Upload a .xlsx or .csv file' });
  }

  const updateExisting = String(req.body?.updateExisting || '').toLowerCase() === 'true'
    || req.body?.updateExisting === true
    || req.body?.updateExisting === '1';

  let rows;
  try {
    rows = await parseStudentBulkFile(req.file);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Could not read the uploaded file',
    });
  }

  if (!rows.length) {
    return res.status(400).json({ message: 'No student rows found in the file' });
  }

  const result = await importStudentsFromRows(rows, { updateExisting });
  if (result.created || result.updated) {
    invalidateStudentCountCache();
  }
  res.json({
    message: `Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`,
    ...result,
  });
};

export const parseBulkUploadStudents = async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ message: 'Upload a .xlsx or .csv file' });
  }

  let rows;
  try {
    rows = await parseStudentBulkFile(req.file);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Could not read the uploaded file',
    });
  }

  if (!rows.length) {
    return res.status(400).json({ message: 'No student rows found in the file' });
  }

  const { validRows, errors } = validateStudentBulkRows(rows);
  res.json({
    total: rows.length,
    validCount: validRows.length,
    invalidCount: errors.length,
    batchSize: BULK_IMPORT_BATCH_SIZE,
    validRows: validRows.map((row) => ({
      rowNumber: row.rowNumber,
      semesterNumber: row.semesterNumber,
      payload: row.payload,
    })),
    errors: errors.slice(0, 100),
  });
};

export const importBulkStudentBatch = async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) {
    return res.status(400).json({ message: 'No student rows provided' });
  }
  if (rows.length > BULK_IMPORT_BATCH_SIZE) {
    return res.status(400).json({
      message: `Import at most ${BULK_IMPORT_BATCH_SIZE} rows per batch`,
    });
  }

  const updateExisting = String(req.body?.updateExisting || '').toLowerCase() === 'true'
    || req.body?.updateExisting === true
    || req.body?.updateExisting === '1';

  const normalizedRows = rows.map((row, index) => ({
    ok: true,
    rowNumber: row.rowNumber ?? index + 2,
    semesterNumber: row.semesterNumber,
    payload: row.payload,
  }));

  const result = await importValidatedStudentRows(normalizedRows, { updateExisting });
  if (result.created || result.updated) {
    invalidateStudentCountCache();
  }

  res.json(result);
};
