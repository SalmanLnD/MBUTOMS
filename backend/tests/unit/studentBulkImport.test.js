import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importStudentsFromRows,
  parseStudentBulkFile,
} from '../../utils/studentBulkImport.js';

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
