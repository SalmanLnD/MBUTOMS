import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createAsyncReportCache } from '../../utils/asyncReportCache.js';
import { invalidateDerivedData } from '../../utils/dataRevision.js';
import { buildAttendanceGridCacheKey, setCachedAttendanceGrid, getCachedAttendanceGrid, clearAttendanceGridCache } from '../../utils/attendanceGridCache.js';
import { getScheduleSubjectRange, isScheduleWithinSubjectDates, clearSubjectStartDateCache } from '../../utils/subjectStartDate.js';
import { buildTopicTrackerPendingBacklog } from '../../utils/topicTrackerSessions.js';
import { exportGuard } from '../../middleware/exportGuard.js';
import { requireAttendanceExportKey } from '../../middleware/attendanceExportAuth.js';
import AppSetting from '../../models/AppSetting.js';
import Subject from '../../models/Subject.js';
import Schedule from '../../models/Schedule.js';
import Trainer from '../../models/Trainer.js';
import Leave from '../../models/Leave.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';
import TopicTrackerEntry from '../../models/TopicTrackerEntry.js';

test('subject windows include end day and reject the following day for IDs and codes', () => {
  const range = { startDate: new Date('2026-08-01'), endDate: new Date('2026-08-31') };
  const map = { byId: new Map([['subject', range]]), byCode: new Map([['CODE', range]]) };
  for (const schedule of [{ subject: { _id: 'subject' } }, { subjectCode: ' CODE ' }]) {
    assert.equal(isScheduleWithinSubjectDates(schedule, '2026-07-31', map), false);
    assert.equal(isScheduleWithinSubjectDates(schedule, '2026-08-01', map), true);
    assert.equal(isScheduleWithinSubjectDates(schedule, '2026-08-31T18:29:59Z', map), true);
    assert.equal(isScheduleWithinSubjectDates(schedule, '2026-08-31T18:30:00Z', map), false);
    assert.equal(isScheduleWithinSubjectDates(schedule, 'invalid', map), false);
    assert.deepEqual(getScheduleSubjectRange(schedule, map), range);
  }
});

test('concurrent report reads share work; writes invalidate; failed loads are retried', async () => {
  const read = createAsyncReportCache();
  let loads = 0;
  const load = async () => { loads++; await new Promise(r => setImmediate(r)); return loads; };
  assert.deepEqual(await Promise.all([read('one', load), read('one', load)]), [1, 1]);
  invalidateDerivedData();
  assert.equal(await read('one', load), 2);
  await assert.rejects(read('failure', () => { throw new Error('temporary'); }));
  assert.equal(await read('failure', () => 3), 3);
});

test('unlinked trainer cache cannot collide with staff reports and invalidates on mutation', () => {
  clearAttendanceGridCache();
  const admin = buildAttendanceGridCacheKey('2026-09', 'III', { role: 'admin' });
  const trainer = buildAttendanceGridCacheKey('2026-09', 'III', { _id: 't', role: 'trainer' });
  assert.notEqual(admin, trainer);
  setCachedAttendanceGrid(admin, { rows: ['private'] });
  assert.equal(getCachedAttendanceGrid(trainer), null);
  invalidateDerivedData();
  assert.equal(getCachedAttendanceGrid(admin), null);
});

const response = () => {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; res.emit('finish'); return res; };
  return res;
};

test('Sheets guard bounds parallel reports, caches success, and recovers after errors', () => {
  invalidateDerivedData();
  const req = { baseUrl: '/api/a', path: '/export', query: {} };
  const first = response();
  exportGuard(req, first, () => {});
  const second = response();
  exportGuard({ ...req, baseUrl: '/api/b' }, second, () => assert.fail('parallel export ran'));
  assert.equal(second.statusCode, 429);
  first.json({ rows: [1] });
  const cached = response();
  exportGuard(req, cached, () => assert.fail('cache missed'));
  assert.deepEqual(cached.body, { rows: [1] });
  invalidateDerivedData();
  const failed = response();
  exportGuard(req, failed, () => failed.status(500).json({ message: 'failed' }));
  let ran = false;
  const recovered = response();
  exportGuard(req, recovered, () => { ran = true; recovered.json({ rows: [] }); });
  assert.equal(ran, true);
});

test('Sheets key DB rejection reaches Express error middleware', async (t) => {
  const expected = new Error('database unavailable');
  t.mock.method(AppSetting, 'findOne', () => ({ lean: async () => { throw expected; } }));
  await new Promise((resolve, reject) => {
    requireAttendanceExportKey({ query: {}, headers: {} }, response(), (error) => {
      try { assert.equal(error, expected); resolve(); } catch (e) { reject(e); }
    });
  });
});

test('backlog respects expiry, closed historical IST entries, and weekly schedule dates', async (t) => {
  const query = (rows) => ({ select() { return this; }, populate() { return this; }, maxTimeMS() { return this; }, lean: async () => rows });
  const subject = { _id: 's', code: 'TEST', name: 'Test', startDate: new Date('2026-08-01'), endDate: new Date('2026-08-10') };
  const schedule = { _id: 'slot', subject, subjectCode: 'TEST', trainerCode: 'T1', day: 'Monday', startTime: '09:00', endTime: '10:00', department: 'CSE', section: 'A', semester: 'III' };
  t.mock.method(Subject, 'find', () => query([subject]));
  t.mock.method(Schedule, 'find', () => query([schedule]));
  t.mock.method(Trainer, 'find', () => query([{ _id: 't1', employeeId: 'T1', name: 'Trainer', scheduleTrainerCodes: [] }]));
  for (const model of [Leave, ClassCancellation, OfficialHoliday]) t.mock.method(model, 'find', () => query([]));
  let entryFilter;
  t.mock.method(TopicTrackerEntry, 'find', (filter) => { entryFilter = filter; return query([{ _id: 'entry', schedule: 'slot', date: new Date('2026-08-02T18:30:00Z'), trackerStatus: 'closed' }]); });
  clearSubjectStartDateCache();
  const result = await buildTopicTrackerPendingBacklog({ from: '2026-08-03', until: '2026-08-31', user: { role: 'admin' } });
  assert.deepEqual(result.items.map(row => row.date), ['2026-08-10']);
  assert.equal(entryFilter.date.$gte.toISOString(), '2026-08-02T18:30:00.000Z');
  await assert.rejects(buildTopicTrackerPendingBacklog({ from: 'invalid', user: { role: 'admin' } }), { statusCode: 400 });
  clearSubjectStartDateCache();
});
