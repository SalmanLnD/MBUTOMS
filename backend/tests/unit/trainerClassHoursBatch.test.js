import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSlotIdentityKey,
  filterOwnedSchedulesForAttendanceDate,
} from '../../utils/trainerClassHoursBatch.js';
import { computeHours } from '../../utils/trainerClassHours.js';

describe('trainer class hours', () => {
  it('buildSlotIdentityKey treats identical slots as duplicates', () => {
    const slotA = {
      day: 'Monday',
      startTime: '09:00',
      endTime: '10:50',
      department: 'AIML',
      section: 'B3',
      subjectCode: '22LG101703',
      semester: 'V',
    };
    const slotB = { ...slotA, trainerCode: 'PSTP-T8' };
    const slotC = { ...slotA, trainerCode: '801777' };

    assert.equal(buildSlotIdentityKey(slotA), buildSlotIdentityKey(slotB));
    assert.equal(buildSlotIdentityKey(slotB), buildSlotIdentityKey(slotC));
  });

  it('computes LRRE V semester slot durations from timetable', () => {
    assert.equal(computeHours('09:00', '10:50'), 1.8333333333333333);
    assert.equal(computeHours('11:10', '13:00'), 1.8333333333333333);
    assert.equal(computeHours('14:45', '16:45'), 2);

    const mondayHours =
      computeHours('09:00', '10:50') + computeHours('14:45', '16:45');
    assert.equal(Math.round(mondayHours * 10) / 10, 3.8);
  });

  it('excludes cancelled and replaced slots from the original trainer hours', () => {
    const schedules = [
      { _id: 'normal', day: 'Friday', startTime: '09:00', endTime: '11:00' },
      { _id: 'cancelled', day: 'Friday', startTime: '11:30', endTime: '13:30' },
      { _id: 'replaced', day: 'Friday', startTime: '14:45', endTime: '16:45' },
    ];

    const result = filterOwnedSchedulesForAttendanceDate(schedules, {
      canceledScheduleIds: new Set(['cancelled']),
      replacedScheduleIds: new Set(['replaced']),
      date: new Date('2026-09-04T00:00:00.000Z'),
      subjectStartMap: { byId: new Map(), byCode: new Map() },
    });

    assert.deepEqual(result.map((schedule) => schedule._id), ['normal']);
  });
});
