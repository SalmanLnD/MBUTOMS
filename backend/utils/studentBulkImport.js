import ExcelJS from 'exceljs';
import Student from '../models/Student.js';
import Semester from '../models/Semester.js';

const STATUS_VALUES = new Set(['active', 'inactive', 'graduated']);
const SEMESTER_NUMBER_BY_LABEL = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
};
const SEMESTER_LABEL_BY_NUMBER = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
};

const HEADER_ALIASES = {
  rollnumber: 'rollNumber',
  'roll number': 'rollNumber',
  'roll no': 'rollNumber',
  'roll no.': 'rollNumber',
  rollno: 'rollNumber',
  name: 'name',
  'student name': 'name',
  email: 'email',
  'email id': 'email',
  branch: 'branch',
  department: 'branch',
  dept: 'branch',
  section: 'sectionLabel',
  'section label': 'sectionLabel',
  sectionlabel: 'sectionLabel',
  py: 'py',
  'passed out year': 'py',
  'pass out year': 'py',
  'passed-out year': 'py',
  'passout year': 'py',
  'passing year': 'py',
  semester: 'semesterLabel',
  sem: 'semesterLabel',
  'current semester': 'semesterLabel',
  status: 'status',
};

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const cellToString = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    if (value.richText) {
      return value.richText.map((part) => part.text || '').join('').trim();
    }
  }
  return String(value).trim();
};

const mapHeaderKey = (header) => HEADER_ALIASES[normalizeHeader(header)] || null;

const normalizeStatus = (value) => {
  const status = String(value || 'active').trim().toLowerCase();
  return STATUS_VALUES.has(status) ? status : null;
};

const normalizeEmail = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
};

const normalizePy = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { ok: true, value: undefined };
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, value: undefined };
  }
  return { ok: true, value: year };
};

const normalizeSemesterLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { ok: true, value: undefined, number: undefined };

  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && SEMESTER_LABEL_BY_NUMBER[asNumber]) {
    return {
      ok: true,
      value: SEMESTER_LABEL_BY_NUMBER[asNumber],
      number: asNumber,
    };
  }

  const cleaned = raw
    .replace(/semester|sem/gi, '')
    .trim()
    .toLowerCase();
  const number = SEMESTER_NUMBER_BY_LABEL[cleaned];
  if (number) {
    return {
      ok: true,
      value: SEMESTER_LABEL_BY_NUMBER[number],
      number,
    };
  }

  return { ok: false, value: undefined, number: undefined };
};

export const STUDENT_BULK_TEMPLATE_HEADERS = [
  'Roll Number',
  'Name',
  'Email',
  'Branch',
  'Section',
  'Passed Out Year',
  'Semester',
  'Status',
];

export const buildStudentBulkTemplateBuffer = async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');
  sheet.addRow(STUDENT_BULK_TEMPLATE_HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([
    '24CSE001',
    'Sample Student',
    'student@example.com',
    'CSE',
    'A',
    2028,
    'III',
    'active',
  ]);
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
  ];
  return workbook.xlsx.writeBuffer();
};

const parseCsv = (buffer) => {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const splitCsvLine = (line) => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
  };

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = { __rowNumber: index + 2 };
    headers.forEach((header, colIndex) => {
      const key = mapHeaderKey(header);
      if (key) row[key] = values[colIndex] || '';
    });
    return row;
  });
};

const parseXlsx = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headerMap = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const key = mapHeaderKey(cellToString(cell.value));
    if (key) headerMap.push({ key, colNumber });
  });

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const parsed = { __rowNumber: rowNumber };
    let hasValue = false;
    headerMap.forEach(({ key, colNumber }) => {
      const value = cellToString(row.getCell(colNumber).value);
      if (value) hasValue = true;
      parsed[key] = value;
    });
    if (hasValue) rows.push(parsed);
  });
  return rows;
};

export const parseStudentBulkFile = async (file) => {
  const name = String(file?.originalname || '').toLowerCase();
  if (name.endsWith('.csv')) {
    return parseCsv(file.buffer);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXlsx(file.buffer);
  }
  const error = new Error('Upload a .xlsx or .csv file');
  error.statusCode = 400;
  throw error;
};

const validateParsedRow = (row) => {
  const rollNumber = String(row.rollNumber || '').trim();
  const name = String(row.name || '').trim();
  const branch = String(row.branch || '').trim();
  const sectionLabel = String(row.sectionLabel || '').trim();
  const email = normalizeEmail(row.email);
  const status = normalizeStatus(row.status);
  const pyResult = normalizePy(row.py);
  const semesterResult = normalizeSemesterLabel(row.semesterLabel);

  const errors = [];
  if (!rollNumber) errors.push('Roll Number is required');
  if (!name) errors.push('Name is required');
  if (email === null) errors.push('Email is invalid');
  if (status === null) errors.push('Status must be active, inactive, or graduated');
  if (!pyResult.ok) errors.push('Passed Out Year must be a 4-digit year (2000–2100)');
  if (!semesterResult.ok) {
    errors.push('Semester must be I–VIII or 1–8');
  }

  if (errors.length) {
    return { ok: false, rowNumber: row.__rowNumber, errors };
  }

  return {
    ok: true,
    rowNumber: row.__rowNumber,
    semesterNumber: semesterResult.number,
    payload: {
      rollNumber,
      name,
      email: email || undefined,
      branch: branch || undefined,
      sectionLabel: sectionLabel || undefined,
      py: pyResult.value,
      semesterLabel: semesterResult.value,
      status: status || 'active',
    },
  };
};

export const importStudentsFromRows = async (rows, { updateExisting = false } = {}) => {
  const validated = rows.map(validateParsedRow);
  const invalid = validated.filter((row) => !row.ok).map((row) => ({
    row: row.rowNumber,
    errors: row.errors,
  }));
  const validPayloads = validated.filter((row) => row.ok);

  if (!validPayloads.length) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: invalid.length,
      errors: invalid,
    };
  }

  const semesterNumbers = [...new Set(
    validPayloads
      .map((row) => row.semesterNumber)
      .filter((number) => Number.isInteger(number))
  )];
  const semesters = semesterNumbers.length
    ? await Semester.find({ number: { $in: semesterNumbers } }).select('_id number').lean()
    : [];
  const semesterIdByNumber = new Map(
    semesters.map((semester) => [semester.number, semester._id])
  );

  const withSemesterRefs = validPayloads.map((row) => {
    const payload = { ...row.payload };
    if (row.semesterNumber && semesterIdByNumber.has(row.semesterNumber)) {
      payload.semester = semesterIdByNumber.get(row.semesterNumber);
    }
    return { ...row, payload };
  });

  const rollNumbers = withSemesterRefs.map((row) => row.payload.rollNumber);
  const existing = await Student.find({ rollNumber: { $in: rollNumbers } })
    .select('rollNumber')
    .lean();
  const existingSet = new Set(existing.map((student) => student.rollNumber));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [...invalid];

  const toCreate = [];
  const toUpdate = [];

  for (const row of withSemesterRefs) {
    if (existingSet.has(row.payload.rollNumber)) {
      if (updateExisting) {
        toUpdate.push(row);
      } else {
        skipped += 1;
        errors.push({
          row: row.rowNumber,
          errors: [`Roll number ${row.payload.rollNumber} already exists`],
        });
      }
    } else {
      toCreate.push(row.payload);
    }
  }

  if (toCreate.length) {
    try {
      const inserted = await Student.insertMany(toCreate, { ordered: false });
      created = inserted.length;
    } catch (error) {
      if (error?.insertedDocs) {
        created = error.insertedDocs.length;
      }
      const writeErrors = error?.writeErrors || [];
      writeErrors.forEach((writeError) => {
        errors.push({
          row: null,
          errors: [writeError.errmsg || writeError.message || 'Failed to insert row'],
        });
      });
      if (!error?.insertedDocs && !writeErrors.length) {
        throw error;
      }
    }
  }

  for (const row of toUpdate) {
    try {
      await Student.updateOne(
        { rollNumber: row.payload.rollNumber },
        { $set: row.payload }
      );
      updated += 1;
    } catch (error) {
      errors.push({
        row: row.rowNumber,
        errors: [error.message || 'Failed to update row'],
      });
    }
  }

  return {
    created,
    updated,
    skipped,
    failed: errors.length,
    errors: errors.slice(0, 100),
  };
};
