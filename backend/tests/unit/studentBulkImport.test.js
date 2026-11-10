import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importStudentsFromRows,
  parseStudentBulkFile,
  validateStudentBulkRows,
  importValidatedStudentRows,
} from '../../utils/studentBulkImport.js';
import Student from '../../models/Student.js';

test('parses csv student bulk rows with flexible headers', async () => {
  const csv = [
    'Roll Number,Name,Email,Branch,Section,Passed Out Year,Semester,Status',
    '24CSE001,Ada Lovelace,ada@example.com,CSE,A,2028,III,active',
    '24CSE002,Grace Hopper,,CSE,B,2027,3,inactive',
  ].join('\n');

  const rows = await parseStudentBulkFile({
    originalname: 'students.csv',
    buffer: Buffer.from(csv, 'utf8'),
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].rollNumber, '24CSE001');
  assert.equal(rows[0].name, 'Ada Lovelace');
  assert.equal(rows[0].branch, 'CSE');
  assert.equal(rows[0].py, '2028');
  assert.equal(rows[0].semesterLabel, 'III');
  assert.equal(rows[1].sectionLabel, 'B');
  assert.equal(rows[1].py, '2027');
  assert.equal(rows[1].semesterLabel, '3');
  assert.equal(rows[1].status, 'inactive');
});

test('validates required fields before import', async () => {
  const result = await importStudentsFromRows([
    { __rowNumber: 2, rollNumber: '', name: 'Missing Roll' },
    { __rowNumber: 3, rollNumber: '24CSE009', name: '', email: 'bad' },
    { __rowNumber: 4, rollNumber: '24CSE010', name: 'Bad Year', py: '99' },
    { __rowNumber: 5, rollNumber: '24CSE011', name: 'Bad Sem', semesterLabel: 'IX' },
  ]);

  assert.equal(result.created, 0);
  assert.equal(result.failed, 4);
  assert.ok(result.errors.some((entry) => entry.row === 2));
  assert.ok(result.errors.some((entry) => entry.row === 3));
  assert.ok(result.errors.some((entry) => entry.row === 4));
  assert.ok(result.errors.some((entry) => entry.row === 5));
});

test('a department-only upload preserves omitted student fields and status', () => {
  const { validRows } = validateStudentBulkRows([
    { __rowNumber: 2, rollNumber: '001', name: 'Student', branch: 'ECE' },
  ]);
  assert.deepEqual(validRows[0].payload, { rollNumber: '001', name: 'Student', branch: 'ECE' });
});

test('rejects every occurrence of duplicate roll numbers before import', () => {
  const { validRows, errors } = validateStudentBulkRows([
    { __rowNumber: 2, rollNumber: '001', name: 'Student', branch: 'CSE' },
    { __rowNumber: 3, rollNumber: '001', name: 'Student', branch: 'ECE' },
  ]);
  assert.equal(validRows.length, 0);
  assert.equal(errors.length, 2);
});

test('bulk transfer updates in place and never resets missing profile fields', async (t) => {
  let operations;
  t.mock.method(Student, 'find', () => ({ select: () => ({ lean: async () => [{ _id: 'stable-id', rollNumber: '001' }] }) }));
  t.mock.method(Student, 'bulkWrite', async (ops) => { operations = ops; return { modifiedCount: 1 }; });
  const rows = validateStudentBulkRows([{ __rowNumber: 2, rollNumber: '001', name: 'Student', branch: 'ECE' }]).validRows;
  const result = await importValidatedStudentRows(rows, { updateExisting: true });
  assert.equal(result.updated, 1);
  assert.deepEqual(operations, [{ updateOne: { filter: { rollNumber: '001' }, update: { $set: { rollNumber: '001', name: 'Student', branch: 'ECE' } } } }]);
});

test('untrusted batch cannot inject student IDs or bypass field validation', async (t) => {
  t.mock.method(Student, 'find', () => { throw new Error('invalid batch must not query database'); });
  const result = await importValidatedStudentRows([
    { rowNumber: 2, payload: { _id: 'injected', rollNumber: '001', name: 'Student', status: 'unknown' } },
  ], { updateExisting: true });
  assert.equal(result.failed, 1);
  assert.equal(result.updated, 0);
});

test('partial successful bulk transfer count reflects database result', async (t) => {
  t.mock.method(Student, 'find', () => ({ select: () => ({ lean: async () => [{ rollNumber: '001' }] }) }));
  t.mock.method(Student, 'bulkWrite', async () => ({ matchedCount: 0, modifiedCount: 0 }));
  const rows = validateStudentBulkRows([{ __rowNumber: 2, rollNumber: '001', name: 'Student', branch: 'ECE' }]).validRows;
  assert.equal((await importValidatedStudentRows(rows, { updateExisting: true })).updated, 0);
});
