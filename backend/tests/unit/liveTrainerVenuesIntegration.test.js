import TopicTrackerEntry from '../../models/TopicTrackerEntry.js';
import { buildTopicTrackerSessions, buildTopicTrackerOverview } from '../../utils/topicTrackerSessions.js';
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
function fixtures(t, { schedules = [schedule()], leaves = [], cancellations = [], holidays = [], trainers = [trainer] } = {}) {
  const query = (rows) => ({
    select() { return this; }, sort() { return this; }, populate() { return this; },
    lean: async () => rows,
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  });
  t.mock.method(User, 'find', () => query([]));
  t.mock.method(Trainer, 'find', () => query(trainers));
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
  t.mock.method(OfficialHoliday, 'find', () => query(holidays));
  t.mock.method(TopicTrackerEntry, 'find', () => query([]));
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
    const result = await live();
    assert.equal(result.trainers[0].status, 'not_available');
    const row = result.trainers.find((r) => r.isExternal);
    assert.equal(row.status, 'in_class');
    assert.equal(row.name, 'Guest');
    assert.equal(row.replacedTrainerName, trainer.name);
  });
});

test('internal replacement occupies the covering trainer row without duplicating the absent owner', async (t) => {
  const cover = { _id: 'cover', employeeId: 'COVER', name: 'Sai Priya' };
  const leave = { trainer: trainer._id, startDate: new Date('2026-09-16'),
    endDate: new Date('2026-09-16'), scope: 'full_day', affectedSchedules: ['slot'],
    replacements: [{ schedule: 'slot', replacementTrainer: cover }] };
  fixtures(t, { trainers: [trainer, cover], leaves: [leave] });
  for (const [time, status] of [['09:59', 'free'], ['10:00', 'in_class'], ['11:59', 'in_class'], ['12:00', 'free']]) {
    const result = await live(undefined, time);
    assert.equal(result.trainers.length, 2);
    assert.equal(result.trainers[0].name, trainer.name);
    assert.equal(result.trainers[0].status, 'not_available');
    const row = result.trainers.find((r) => r.employeeId === 'COVER');
    assert.equal(row.status, status);
    if (status === 'in_class') {
      assert.equal(row.venue.name, 'Room 101');
      assert.equal(row.schedule.isReplacementAssignment, true);
      assert.equal(row.replacedTrainerName, trainer.name);
    }
  }
});

test('cancelled replacement classes do not occupy the covering trainer', async (t) => {
  const cover = { _id: 'cover', employeeId: 'COVER', name: 'Cover' };
  fixtures(t, { trainers: [trainer, cover], cancellations: [{ schedules: ['slot'] }], leaves: [{
    trainer: trainer._id, startDate: new Date('2026-09-16'), endDate: new Date('2026-09-16'),
    scope: 'full_day', replacements: [{ schedule: 'slot', replacementTrainer: cover }],
  }] });
  assert.equal((await live()).trainers.find((r) => r.employeeId === 'COVER').status, 'free');
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

 test('holidays suppress owned, special, and replacement classes on any operational date', async (t) => {
   for (const date of ['2026-09-16', '2026-09-23']) {
     await t.test(date, async (t) => {
       const leave = { trainer: trainer._id, startDate: new Date(date), endDate: new Date(date),
         scope: 'full_day', affectedSchedules: ['slot'], replacements: [{ schedule: 'slot', isExternal: true, externalTrainerName: 'Guest' }] };
       fixtures(t, { schedules: [schedule(), schedule({ _id: 'special-slot', isSpecial: true, specialType: 'one_time',
         specialStartDate: new Date(date), specialEndDate: new Date(date) })],
         holidays: [{ date: new Date(date), name: 'Test holiday' }], leaves: [leave] });
       const result = await live(date);
       assert.equal(result.trainers.length, 1);
       assert.equal(result.trainers[0].status, 'free');
       assert.equal(result.trainers[0].venue, null);
       assert.equal(result.trainers[0].schedule, null);
     });
   }
 });

test('day overview and tracker sessions exclude holidays and selected cancellations across dates', async (t) => {
  for (const date of ['2026-09-16', '2026-09-23']) {
    for (const mode of ['working', 'holiday', 'cancelled', 'partial cancellation']) {
      await t.test(date + ' ' + mode, async (t) => {
        const schedules = [schedule({ subject }), schedule({ _id: 'other-slot', subject, startTime: '13:00', endTime: '15:00' })];
        fixtures(t, { schedules, holidays: mode === 'holiday' ? [{ date: new Date(date) }] : [],
          cancellations: mode === 'cancelled' ? [{ schedules: ['slot', 'other-slot'] }]
            : mode === 'partial cancellation' ? [{ schedules: ['slot'] }] : [] });
        const expected = mode === 'working' ? 2 : mode === 'partial cancellation' ? 1 : 0;
        const sessions = await buildTopicTrackerSessions({ date, user: { role: 'admin' }, lite: true });
        assert.equal(sessions.sessions.length, expected);
        const overview = await buildTopicTrackerOverview({ date, user: { role: 'admin' } });
        assert.equal(overview.subjects.reduce((sum, row) => sum + row.allottedSlots, 0), expected);
        if (mode === 'partial cancellation') assert.equal(sessions.sessions[0].scheduleId, 'other-slot');
      });
    }
  }
});
