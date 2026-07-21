import ExcelJS from 'exceljs';
import Student from '../models/Student.js';

const STATUS_VALUES = new Set(['active', 'inactive', 'graduated']);

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

export const STUDENT_BULK_TEMPLATE_HEADERS = [
  'Roll Number',
  'Name',
  'Email',
  'Branch',
  'Section',
  'Status',
];

export const buildStudentBulkTemplateBuffer = async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');
  sheet.addRow(STUDENT_BULK_TEMPLATE_HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(['24CSE001', 'Sample Student', 'student@example.com', 'CSE', 'A', 'active']);
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 28 },
    { width: 12 },
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

  const errors = [];
  if (!rollNumber) errors.push('Roll Number is required');
  if (!name) errors.push('Name is required');
  if (email === null) errors.push('Email is invalid');
  if (status === null) errors.push('Status must be active, inactive, or graduated');

  if (errors.length) {
    return { ok: false, rowNumber: row.__rowNumber, errors };
  }

  return {
    ok: true,
    rowNumber: row.__rowNumber,
    payload: {
      rollNumber,
      name,
      email: email || undefined,
      branch: branch || undefined,
      sectionLabel: sectionLabel || undefined,
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

  const rollNumbers = validPayloads.map((row) => row.payload.rollNumber);
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

  for (const row of validPayloads) {
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
