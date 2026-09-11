import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../templates/trainer-attendance-sync.gs', import.meta.url), 'utf8');
function harness() {
  const calls = [];
  const range = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return range; } });
  const sheet = new Proxy({}, { get: (_, name) => (...args) => {
    if (name === 'getRange') return range;
    if (name === 'getMaxColumns' || name === 'getMaxRows') return 100;
    calls.push([name, ...args]);
    return sheet;
  } });
  const spreadsheet = { getSheetByName: () => sheet, toast() {} };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush: () => calls.push(['flush']) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => calls.push(['release']) }) },
    Utilities: { formatDate: () => 'today', sleep() {} },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' }, Logger: { log() {} },
  });
  vm.runInContext(source, context);
  return { context, calls };
}

test('RTET is written and flushed even when attendance API returns 502', () => {
  const { context, calls } = harness();
  context.fetchTomsJson = url => {
    calls.push(['fetch', url]);
    if (url === '__EXPORT_URL__') throw new Error('HTTP 502');
    return { dateLabels: ['11 Sept 2026'], subjects: [{ name: 'Subject A', hours: [2] }] };
  };
  assert.throws(() => context.syncTrainerAttendance(), /Attendance: HTTP 502/);
  const write = calls.findIndex(c => c[0] === 'setValues');
  const attendance = calls.findIndex(c => c[0] === 'fetch' && c[1] === '__EXPORT_URL__');
  assert.ok(write >= 0 && write < attendance);
  assert.ok(calls.slice(write, attendance).some(c => c[0] === 'flush'));
  assert.equal(calls[write][1][1][2], 2);
  assert.equal(calls.at(-1)[0], 'release');
});

test('RTET failure preserves old data and fails the trigger visibly', () => {
  const { context, calls } = harness();
  context.fetchTomsJson = () => { throw new Error('HTTP 503'); };
  assert.throws(() => context.syncRTETOnly(), /HTTP 503/);
  assert.ok(calls.some(c => c[0] === 'setNote'));
  assert.ok(!calls.some(c => c[0] === 'clear' || c[0] === 'setValues'));
  assert.equal(calls.at(-1)[0], 'release');
});

test('attendance is still attempted when RTET fails', () => {
  const { context, calls } = harness();
  context.fetchTomsJson = url => {
    if (url === '__RTET_EXPORT_URL__') throw new Error('RTET unavailable');
    calls.push(['attendanceAttempted']);
    return { rows: [] };
  };
  assert.throws(() => context.syncTrainerAttendance(), /RTET: RTET unavailable/);
  assert.ok(calls.some(c => c[0] === 'attendanceAttempted'));
});
