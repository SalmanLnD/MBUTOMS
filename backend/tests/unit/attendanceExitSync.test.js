import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildActiveAttendanceFilter } from '../../utils/trainerEmployment.js';
import User from '../../models/User.js';
import Trainer from '../../models/Trainer.js';
import { exportTrainerAttendanceForSheets } from '../../controllers/attendanceSheetsController.js';

const script = fs.readFileSync(new URL('../../templates/trainer-attendance-sync.gs', import.meta.url), 'utf8');
const context = () => { const ctx = vm.createContext({ Utilities: { formatDate: date => date.toISOString().slice(0, 10) }, SpreadsheetApp: { flush() {} } }); vm.runInContext(script, ctx); return ctx; };

test('old Apps Script cannot clear attendance before Exit-preserving script is installed', async () => {
  let status, body;
  await exportTrainerAttendanceForSheets({ query: {} }, { status(code) { status = code; return this; }, json(value) { body = value; } });
  assert.equal(status, 409); assert.match(body.message, /preserves Exit history/);
});

test('reactivated trainers bypass old roster flags but inactive trainers are excluded', async t => {
  t.mock.method(User, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  t.mock.method(Trainer, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  const filter = await buildActiveAttendanceFilter({ _id: 'sumit' });
  assert.deepEqual(filter.$and[1], { status: 'active' });
  assert.deepEqual(filter.$and[2].$or[0], { directoryReactivatedAt: { $ne: null } });
});

test('restored history survives daily sync and explicit saved attendance can update it', () => {
  const ctx = context();
  const headers = [['Trainer', 'Employee ID', '01 Jul 2026', '', '', ''], ['', '', 'OIF', 'Mock', 'Class', 'Food Allowance']];
  const snapshot = { headers, row: ['Sumit', '136316', 'CT27004', 2, 4, 'dinner'] };
  const incoming = [...headers, ['Sumit', '136316', '', 0, 0, 'none']];
  const restored = ctx.mergeAttendanceHistory(incoming, [snapshot], [], '2026-10-21');
  assert.deepEqual(Array.from(restored[2]), snapshot.row);
  const next = ctx.mergeAttendanceHistory(incoming, [{ headers, row: restored[2] }], [], '2026-10-22');
  assert.deepEqual(Array.from(next[2]), snapshot.row);
  const edited = ctx.mergeAttendanceHistory(incoming, [snapshot], [{ employeeId: '136316', date: '2026-07-01' }], '2026-10-21');
  assert.equal(edited[2][4], 0);
});

test('inactive full rows are archived once; restored snapshots are queued for removal only after active write', () => {
  const ctx = context();
  const headers = [['Trainer', 'Employee ID', '01 Jul 2026', '', '', ''], ['', '', 'OIF', 'Mock', 'Class', 'Food Allowance']];
  class Sheet {
    constructor(rows = []) { this.rows = rows; this.notes = {}; this.writes = 0; }
    getLastRow() { return this.rows.length; } getLastColumn() { return 6; }
    getMaxColumns() { return 100; } getMaxRows() { return 100; }
    getRange(row, column, height = 1, width = 1) {
      const sheet = this;
      return { sheet, row, height, width,
        getValues: () => Array.from({ length: height }, (_, i) => sheet.rows[row - 1 + i] || Array(width).fill('')),
        getNotes: () => Array.from({ length: height }, (_, i) => [sheet.notes[row + i] || '']),
        setNote: value => { sheet.notes[row] = value; sheet.writes++; },
        copyTo: destination => { for (let i = 0; i < height; i++) destination.sheet.rows[destination.row - 1 + i] = sheet.rows[row - 1 + i].slice(); destination.sheet.writes++; },
      };
    }
  }
  const active = new Sheet([...headers, ['Old trainer', '100', 'CT1', 2, 3, 'dinner']]);
  const exit = new Sheet(); const spreadsheet = { getSheetByName: () => exit };
  const payload = { rows: headers, inactiveEmployeeIds: ['100'] };
  ctx.prepareAttendanceMoves(spreadsheet, active, payload);
  const writes = exit.writes;
  assert.equal(Object.values(exit.notes)[0], 'TOMS_ATTENDANCE_ARCHIVE:100');
  ctx.prepareAttendanceMoves(spreadsheet, active, payload);
  assert.equal(exit.writes, writes);
  const restore = ctx.prepareAttendanceMoves(spreadsheet, new Sheet(), { rows: [...headers, ['Old trainer', '100', '', 0, 0, 'none']] });
  assert.equal(restore.restored.length, 1);
  assert.equal(restore.rows[2][2], 'CT1');
  assert.equal(exit.writes, writes);
});
