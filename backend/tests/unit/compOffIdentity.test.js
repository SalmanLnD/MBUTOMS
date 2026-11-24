import test from 'node:test';
import assert from 'node:assert/strict';
import Trainer from '../../models/Trainer.js';
import CompOff from '../../models/CompOff.js';
import { createCompOff } from '../../controllers/compOffController.js';
import {
  resolveCompOffRows, getCompOffTrainerFilter, buildCompOffSummaryByEmployee,
  getPendingCompOffBalance, consumeCompOffForAttendance, releaseCompOffForAttendance,
} from '../../utils/compOffService.js';

const trainer = { _id: 'trainer-a', name: 'Trainer A', employeeId: 'NEW123' };
const other = { _id: 'trainer-b', name: 'Trainer B', employeeId: 'OTHER456' };
const query = (value) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  lean: async () => value,
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

test('creating a credit uses latest trainer identity despite stale form employee ID', async (t) => {
  t.mock.method(Trainer, 'findById', () => query(trainer));
  let created;
  t.mock.method(CompOff, 'create', async (data) => { created = data; return { _id: 'credit' }; });
  t.mock.method(CompOff, 'findById', () => query({ ...created, trainer }));
  let response;
  const res = { status(code) { assert.equal(code, 201); return this; }, json(data) { response = data; } };
  await createCompOff({ user: { role: 'admin' }, body: {
    trainerId: trainer._id, employeeId: 'OLD123', name: 'Old Name', base: 'Tirupati',
    dateWorkedOn: '2026-11-22', uniqueId: 'OLD123-credit', count: 1,
  } }, res);
  assert.equal(created.employeeId, trainer.employeeId);
  assert.equal(created.name, trainer.name);
  assert.equal(created.trainer, trainer._id);
  assert.equal(response.employeeId, trainer.employeeId);
  assert.equal(response.uniqueId, 'OLD123-credit');
});

test('old employee IDs display and aggregate under the linked trainer latest ID', async (t) => {
  t.mock.method(Trainer, 'find', () => query([trainer, other]));
  const rows = await resolveCompOffRows([
    { trainer: trainer._id, employeeId: 'OLD123', name: 'Old Name', count: 1, status: 'pending', dateWorkedOn: '2026-11-22', uniqueId: 'credit-1' },
    { trainer: { _id: trainer._id }, employeeId: 'NEW123', name: trainer.name, count: 0.5, status: 'pending', dateWorkedOn: '2026-11-21', uniqueId: 'credit-2' },
    { trainer: null, employeeId: 'LEGACY123', name: trainer.name, count: 1, status: 'pending', dateWorkedOn: '2026-11-20', uniqueId: 'credit-3' },
  ]);
  assert.ok(rows.every((row) => row.employeeId === 'NEW123' && row.name === trainer.name));
  const summary = buildCompOffSummaryByEmployee(rows);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].pendingCount, 2.5);
  assert.equal(summary[0].hasMultipleEmployeeIds, false);
});

test('ambiguous names and existing links are not reassigned by name', async (t) => {
  t.mock.method(Trainer, 'find', () => query([trainer, { ...other, name: trainer.name }]));
  const rows = await resolveCompOffRows([
    { trainer: null, employeeId: 'OLD', name: trainer.name },
    { trainer: 'deleted-trainer', employeeId: 'OLD', name: trainer.name },
    { trainer: other._id, employeeId: 'OLD', name: trainer.name },
  ]);
  assert.equal(rows[0].employeeId, 'OLD');
  assert.equal(rows[1].employeeId, 'OLD');
  assert.equal(rows[2].employeeId, other.employeeId);
  const filter = await getCompOffTrainerFilter(trainer);
  assert.equal(filter.$or.length, 2);
});

test('trainer credit filter covers old linked IDs and uniquely named unlinked legacy credits', async (t) => {
  t.mock.method(Trainer, 'find', () => query([trainer, other]));
  const filter = await getCompOffTrainerFilter(trainer);
  assert.deepEqual(filter.$or, [
    { trainer: trainer._id },
    { trainer: null, employeeId: trainer.employeeId },
    { trainer: null, name: trainer.name, employeeId: { $nin: ['NEW123', 'OTHER456'] } },
  ]);
});

test('balance, attendance consumption and release use trainer identity after an ID change', async (t) => {
  t.mock.method(Trainer, 'find', () => query([trainer, other]));
  t.mock.method(Trainer, 'findById', () => query(trainer));
  const filters = [];
  let saves = 0;
  const credit = {
    _id: 'credit-1', trainer: trainer._id, employeeId: 'OLD123', count: 1, status: 'pending',
    async save() { saves += 1; },
  };
  t.mock.method(CompOff, 'find', (filter) => { filters.push(filter); return query([credit]); });
  assert.equal(await getPendingCompOffBalance({ trainerId: trainer._id }), 1);
  assert.deepEqual(await consumeCompOffForAttendance({ trainerId: trainer._id, attendanceDate: '2026-11-24' }), ['credit-1']);
  assert.equal(credit.status, 'closed');
  assert.deepEqual(await releaseCompOffForAttendance({ trainerId: trainer._id, attendanceDate: '2026-11-24' }), ['credit-1']);
  assert.equal(credit.status, 'pending');
  assert.equal(saves, 2);
  assert.ok(filters.every((filter) => filter.$or[0].trainer === trainer._id && !filter.employeeId));
});
