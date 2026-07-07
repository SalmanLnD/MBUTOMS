import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildQavaSchedulePayloads } from '../../utils/qavaTimetable.js';
import { QAVA_THREE_SLOT_TIMINGS, getSubjectSlotProfile, QAVA_SUBJECT_CODE } from '../../utils/subjectSlotTimings.js';
import {
  classSlotKey,
  findClassTimeOverlaps,
  findTrainerTimeOverlaps,
  integrityScheduleKey,
} from '../../utils/timetableIntegrity.js';
import { buildAllExpectedSchedulePayloads } from '../../utils/timetableSourceExpectations.js';
import { timesOverlap } from '../../utils/timetableSlots.js';

const slot = (overrides) => ({
  trainerCode: 'T1',
  semester: 'III',
  day: 'Monday',
  startTime: '09:00',
  endTime: '10:00',
  department: 'CSE',
  section: 'A1',
  subjectCode: 'SUBJ1',
  slot: 'S1',
  ...overrides,
});

describe('QAVA slot timings', () => {
  it('uses three SOLAS-style periods', () => {
    const profile = getSubjectSlotProfile(QAVA_SUBJECT_CODE);
    assert.equal(profile.slotCount, 3);
    assert.deepEqual(profile.timings.s1, QAVA_THREE_SLOT_TIMINGS.s1);
    assert.deepEqual(profile.timings.s2, QAVA_THREE_SLOT_TIMINGS.s2);
    assert.deepEqual(profile.timings.s3, QAVA_THREE_SLOT_TIMINGS.s3);
  });

  it('maps imported schedules to the QAVA profile', () => {
    const payloads = buildQavaSchedulePayloads();
    for (const entry of payloads) {
      const timing = QAVA_THREE_SLOT_TIMINGS[entry.slot.toLowerCase()];
      assert.equal(entry.startTime, timing.startTime);
      assert.equal(entry.endTime, timing.endTime);
    }
  });
});

describe('timesOverlap', () => {
  it('detects overlapping intervals', () => {
    assert.equal(timesOverlap('09:00', '11:00', '10:00', '12:00'), true);
  });

  it('treats adjacent intervals as non-overlapping', () => {
    assert.equal(timesOverlap('09:00', '10:00', '10:00', '11:00'), false);
  });

  it('detects contained intervals', () => {
    assert.equal(timesOverlap('09:00', '12:00', '10:00', '11:00'), true);
  });
});

describe('integrityScheduleKey', () => {
  it('builds a stable key for timetable rows', () => {
    const key = integrityScheduleKey(slot({ slot: 'S2', subjectCode: '22LG101703' }));
    assert.equal(key, 'T1|III|Monday|S2|CSE|A1|22LG101703');
  });

  it('falls back to time range when slot is missing', () => {
    const key = integrityScheduleKey(slot({ slot: '', startTime: '14:45', endTime: '16:45' }));
    assert.equal(key, 'T1|III|Monday|14:45-16:45|CSE|A1|SUBJ1');
  });
});

describe('findTrainerTimeOverlaps', () => {
  it('returns no conflicts for distinct slots on the same day', () => {
    const schedules = [
      slot({ startTime: '09:00', endTime: '10:50', slot: 'S1' }),
      slot({ startTime: '11:10', endTime: '13:00', slot: 'S2' }),
    ];
    assert.equal(findTrainerTimeOverlaps(schedules).length, 0);
  });

  it('flags two classes at overlapping times for one trainer', () => {
    const schedules = [
      slot({ startTime: '09:00', endTime: '11:00' }),
      slot({ startTime: '10:00', endTime: '12:00', department: 'AIML', section: 'B1' }),
    ];
    assert.equal(findTrainerTimeOverlaps(schedules).length, 1);
  });

  it('ignores different trainers on the same day and time', () => {
    const schedules = [
      slot({ trainerCode: 'T1', startTime: '09:00', endTime: '11:00' }),
      slot({ trainerCode: 'T2', startTime: '09:00', endTime: '11:00' }),
    ];
    assert.equal(findTrainerTimeOverlaps(schedules).length, 0);
  });
});

describe('findClassTimeOverlaps', () => {
  it('groups by class day and detects overlaps', () => {
    const schedules = [
      slot({ trainerCode: 'T1', startTime: '09:00', endTime: '11:00', subjectCode: 'A' }),
      slot({ trainerCode: 'T2', startTime: '10:00', endTime: '12:00', subjectCode: 'B' }),
    ];
    assert.equal(findClassTimeOverlaps(schedules).length, 1);
    assert.equal(classSlotKey(schedules[0]), 'CSE|A1|III|Monday');
  });

  it('allows the same class in non-overlapping slots', () => {
    const schedules = [
      slot({ trainerCode: 'T1', startTime: '09:00', endTime: '10:50', slot: 'S1' }),
      slot({ trainerCode: 'T2', startTime: '11:10', endTime: '13:00', slot: 'S2' }),
    ];
    assert.equal(findClassTimeOverlaps(schedules).length, 0);
  });
});

describe('import source payloads', () => {
  it('defines unique expected schedule keys', () => {
    const payloads = buildAllExpectedSchedulePayloads();
    const keys = payloads.map(integrityScheduleKey);
    assert.ok(payloads.length > 0);
    assert.equal(keys.length, new Set(keys).size);
  });

  it('contains no trainer overlaps in source definitions', () => {
    const payloads = buildAllExpectedSchedulePayloads();
    assert.equal(findTrainerTimeOverlaps(payloads).length, 0);
  });

  it('contains no class overlaps in source definitions', () => {
    const payloads = buildAllExpectedSchedulePayloads();
    assert.equal(findClassTimeOverlaps(payloads).length, 0);
  });
});
