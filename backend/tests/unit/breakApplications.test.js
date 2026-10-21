import { test } from 'node:test';
import assert from 'node:assert/strict';
import Trainer from '../../models/Trainer.js';
import Leave from '../../models/Leave.js';
import Schedule from '../../models/Schedule.js';
import Subject from '../../models/Subject.js';
import User from '../../models/User.js';
import TrainerDailyAttendance from '../../models/TrainerDailyAttendance.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';
import { buildTrainerAttendanceGridPayload } from '../../controllers/trainerAttendanceController.js';
import { buildTrainerAttendanceExportPayload } from '../../utils/trainerAttendanceExport.js';
import { createLeave } from '../../controllers/leaveController.js';
import { applyDefaultExcessRrdAttendance } from '../../utils/excessRrdAttendance.js';
import { clearSubjectStartDateCache } from '../../utils/subjectStartDate.js';

const query = rows => ({ select() { return this; }, populate() { return this; }, sort() { return this; },
  lean: async () => rows, then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); } });

test('break is pending on submission and has a distinct request type', async t => {
  let created;
  t.mock.method(Trainer, 'findById', async () => ({ _id: 'trainer', employeeId: '100' }));
  t.mock.method(Schedule, 'find', () => query([]));
  t.mock.method(Subject, 'find', () => query([]));
  t.mock.method(ClassCancellation, 'find', () => query([]));
  t.mock.method(OfficialHoliday, 'find', () => query([]));
  t.mock.method(Leave, 'create', async value => { created = new Leave(value); return created; });
  t.mock.method(Leave, 'findById', () => query(created));
  clearSubjectStartDateCache();
  const res = { status() { return this; }, json() {} };
  await createLeave({ user: { role: 'trainer', trainer: 'trainer' }, body: {
    startDate: '2026-10-18', endDate: '2026-10-19', reason: 'Break request', requestType: 'break',
  } }, res);
  assert.equal(created.requestType, 'break');
  assert.equal(created.status, 'pending');
  assert.equal(created.scope, 'full_day');
  assert.deepEqual(await applyDefaultExcessRrdAttendance({ leave: created }), { eLeaveKeys: [] });
});

test('approved break overrides saved leave, Sunday and holiday in grid and export; cancellation restores normal attendance', async t => {
  const trainer = { _id: 'trainer', name: 'Trainer', employeeId: '100', joiningDate: '2026-07-01' };
  let approved = true;
  const leave = { _id: 'break', trainer: 'trainer', requestType: 'break', scope: 'full_day',
    startDate: '2026-10-18', endDate: '2026-10-19', status: 'approved' };
  t.mock.method(Trainer, 'find', () => query([trainer]));
  t.mock.method(Trainer, 'findOne', () => query(null));
  t.mock.method(User, 'find', () => query([]));
  t.mock.method(Subject, 'find', () => query([]));
  t.mock.method(Schedule, 'find', () => query([]));
  t.mock.method(ClassCancellation, 'find', () => query([]));
  t.mock.method(OfficialHoliday, 'find', () => query([{ date: '2026-10-19', name: 'Test holiday' }]));
  t.mock.method(TrainerDailyAttendance, 'find', () => query([{ trainer: 'trainer', date: '2026-10-18', attendanceType: 'e_leave' }]));
  t.mock.method(Leave, 'find', filter => query(approved && filter.trainer && !filter.$or ? [leave] : []));
  clearSubjectStartDateCache();
  const grid = await buildTrainerAttendanceGridPayload({ month: '2026-10', user: { role: 'admin' }, refresh: true });
  for (const key of ['2026-10-18', '2026-10-19']) {
    assert.equal(grid.rows[0].days[key].attendanceType, 'break');
    assert.equal(grid.rows[0].days[key].classHandlingHours, 0);
  }
  const output = await buildTrainerAttendanceExportPayload();
  const sunday = output.rows[0].indexOf('18 Oct 2026');
  assert.ok(sunday >= 2);
  assert.equal(output.rows[2][sunday], 'Break');
  assert.equal(output.rows[2][sunday + 4], 'Break');
  approved = false;
  const cancelled = await buildTrainerAttendanceGridPayload({ month: '2026-10', user: { role: 'admin' }, refresh: true });
  assert.notEqual(cancelled.rows[0].days['2026-10-18'].attendanceType, 'break');
  assert.notEqual(cancelled.rows[0].days['2026-10-19'].attendanceType, 'break');
});
