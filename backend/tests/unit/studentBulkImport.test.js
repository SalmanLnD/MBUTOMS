import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importStudentsFromRows,
  parseStudentBulkFile,
} from '../../utils/studentBulkImport.js';

test('parses csv student bulk rows with flexible headers', async () => {
  const csv = [
    'Roll Number,Name,Email,Branch,Section,Status',
    '24CSE001,Ada Lovelace,ada@example.com,CSE,A,active',
    '24CSE002,Grace Hopper,,CSE,B,inactive',
  ].join('\n');

  const rows = await parseStudentBulkFile({
    originalname: 'students.csv',
    buffer: Buffer.from(csv, 'utf8'),
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].rollNumber, '24CSE001');
  assert.equal(rows[0].name, 'Ada Lovelace');
  assert.equal(rows[0].branch, 'CSE');
  assert.equal(rows[1].sectionLabel, 'B');
  assert.equal(rows[1].status, 'inactive');
});

test('validates required fields before import', async () => {
  const result = await importStudentsFromRows([
    { __rowNumber: 2, rollNumber: '', name: 'Missing Roll' },
    { __rowNumber: 3, rollNumber: '24CSE009', name: '', email: 'bad' },
  ]);

  assert.equal(result.created, 0);
  assert.equal(result.failed, 2);
  assert.ok(result.errors.some((entry) => entry.row === 2));
  assert.ok(result.errors.some((entry) => entry.row === 3));
});
