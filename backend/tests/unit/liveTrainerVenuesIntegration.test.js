import test from 'node:test';
import assert from 'node:assert/strict';
import Schedule from '../../models/Schedule.js';
import Subject from '../../models/Subject.js';
import Trainer from '../../models/Trainer.js';
import Leave from '../../models/Leave.js';
import User from '../../models/User.js';
import ClassCancellation from '../../models/ClassCancellation.js';
import OfficialHoliday from '../../models/OfficialHoliday.js';
import { buildLiveTrainerVenues } from '../../utils/liveTrainerVenues.js';
import { buildSubjectStartDateMap, clearSubjectStartDateCache } from '../../utils/subjectStartDate.js';
import { computeClassHandlingHours } from '../../utils/trainerClassHours.js';
import { buildRtetExportPayload, RTET_SUBJECTS } from '../../utils/rtetExport.js';

const trainer = { _id: 'trainer-main', employeeId: 'MAIN', name: 'Main Trainer' };
const subject = { _id: 'subject', code: RTET_SUBJECTS[0].code, name: 'Course',
  startDate: new Date('2026-09-16'), endDate: new Date('2026-09-23') };
const schedule = (overrides = {}) => ({
  _id: 'slot', trainerCode: 'MAIN', subject: 'subject', subjectCode: subject.code,
  day: 'Wednesday', startTime: '10:00', endTime: '12:00', department: 'CSE', section: 'A',
  venue: { _id: 'venue', name: 'Room 101', building: 'Block A', floor: '1' }, ...overrides,
});
function fixtures(t, { schedules = [schedule()], leaves = [], cancellations = [] } = {}) {
  const query = (rows) => ({
    select() { return this; }, sort() { return this; }, populate() { return this; },
    lean: async () => rows,
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  });
  t.mock.method(User, 'find', () => query([]));
  t.mock.method(Trainer, 'find', () => query([trainer]));
  t.mock.method(Trainer, 'findById', async () => trainer);
  t.mock.method(Subject, 'find', () => query([subject]));
  t.mock.method(Schedule, 'find', (filter) => query(schedules.filter((row) =>
    filter._id ? filter._id.$in.includes(row._id)
      : filter.trainerCode ? filter.trainerCode.$in.includes(row.trainerCode) : true
  )));
  t.mock.method(Leave, 'find', (filter) => query(leaves.filter((leave) =>
    filter['replacements.0'] ? leave.replacements?.length : true
  )));
  t.mock.method(ClassCancellation, 'find', () => query(cancellations));
  t.mock.method(OfficialHoliday, 'find', () => query([]));
  clearSubjectStartDateCache();
  t.after(clearSubjectStartDateCache);
}
const live = (date = '2026-09-16', time = '11:00') => buildLiveTrainerVenues({
  now: new Date(`${date}T11:00:00+05:30`), ...(time === null ? {} : { time }),
});

test('Venue Live finds current classes through the real subject-range cache and timetable board', async (t) => {
  for (const linkage of [{ subject: 'subject' }, { subject: { _id: 'subject' } },
    { subject: null, subjectCode: ` ${subject.code} ` }, { subject: null, subjectCode: '' }]) {
    await t.test(JSON.stringify(linkage), async (t) => {
      fixtures(t, { schedules: [schedule(linkage)] });
      const result = await live(undefined, null);
      assert.equal(result.isLive, true);
      assert.equal(result.currentTime, '11:00');
      assert.equal(result.trainers[0].status, 'in_class');
      assert.equal(result.trainers[0].venue.name, 'Room 101');
      assert.equal(result.trainers[0].schedule._id, 'slot');
    });
  }
});

test('subject dates and clock boundaries are independent in Venue Live', async (t) => {
  fixtures(t);
  for (const [date, insideDates] of [['2026-09-09', false], ['2026-09-16', true],
    ['2026-09-23', true], ['2026-09-30', false]]) {
    for (const [time, insideSlot] of [['09:59', false], ['10:00', true], ['11:59', true], ['12:00', false]]) {
      const result = await live(date, time);
      assert.equal(result.trainers[0].status, insideDates && insideSlot ? 'in_class' : 'free', `${date} ${time}`);
      assert.equal(result.date, date);
      assert.equal(result.isLive, false);
    }
  }
  assert.equal((await live('2026-09-17')).trainers[0].status, 'free');
});

test('a class without a venue stays in class; cancelled classes are free', async (t) => {
  await t.test('missing venue', async (t) => {
    fixtures(t, { schedules: [schedule({ venue: null })] });
    assert.equal((await live()).trainers[0].status, 'in_class_no_venue');
  });
  await t.test('cancelled class', async (t) => {
    fixtures(t, { cancellations: [{ schedules: ['slot'] }] });
    assert.equal((await live()).trainers[0].status, 'free');
  });
});

test('leave and external replacement statuses still use the active class', async (t) => {
  const leave = { trainer: trainer._id, startDate: new Date('2026-09-16'),
    endDate: new Date('2026-09-16'), scope: 'full_day', affectedSchedules: ['slot'] };
  await t.test('approved full-day leave', async (t) => {
    fixtures(t, { leaves: [leave] });
    assert.equal((await live()).trainers[0].status, 'not_available');
  });
  await t.test('external cover', async (t) => {
    fixtures(t, { leaves: [{ ...leave, replacements: [{ schedule: 'slot', isExternal: true, externalTrainerName: 'Guest' }] }] });
    const row = (await live()).trainers[0];
    assert.equal(row.status, 'in_class');
    assert.equal(row.name, 'Guest');
    assert.equal(row.replacedTrainerName, trainer.name);
  });
});

test('Venue Live leaves the subject-cache contract, attendance hours and RTET output intact', async (t) => {
  fixtures(t);
  const map = await buildSubjectStartDateMap();
  const beforeMap = structuredClone(map);
  const date = new Date('2026-09-16T11:00:00+05:30');
  const beforeHours = await computeClassHandlingHours(trainer._id, date);
  const beforeRtet = await buildRtetExportPayload();
  assert.equal(beforeHours, 2);
  assert.ok(beforeRtet.subjects[0].hours.includes(2));
  for (const time of ['09:00', '11:00', '13:00']) await live(undefined, time);
  assert.deepEqual(await buildSubjectStartDateMap(), beforeMap);
  assert.equal(await computeClassHandlingHours(trainer._id, date), beforeHours);
  assert.deepEqual(await buildRtetExportPayload(), beforeRtet);
});
