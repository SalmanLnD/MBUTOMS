import { buildIIIsemesterSchedulePayloads } from './iiiSemesterTimetables.js';
import { buildQavaSchedulePayloads } from './qavaTimetable.js';
import { buildNavyaSchedulePayloads } from './navyaTimetable.js';
import { buildAdminMcaSchedulePayloads } from './adminTimetable.js';
import { buildPstpSchedulePayloads } from './pstpTimetable.js';
import {
  LRRE_V_TRAINER_ALLOCATIONS,
  buildExpectedScheduleRecord,
} from './lrreVSemesterTimetable.js';
import { integrityScheduleKey } from './timetableIntegrity.js';

export const buildAllExpectedSchedulePayloads = () => {
  const payloads = [
    ...buildIIIsemesterSchedulePayloads(),
    ...buildQavaSchedulePayloads(),
    ...buildNavyaSchedulePayloads(),
    ...buildAdminMcaSchedulePayloads(),
    ...buildPstpSchedulePayloads(),
  ];

  for (const [employeeId, allocation] of Object.entries(LRRE_V_TRAINER_ALLOCATIONS)) {
    for (const slot of allocation.slots) {
      payloads.push(buildExpectedScheduleRecord(employeeId, slot, null));
    }
  }

  return payloads;
};

export const buildExpectedScheduleKeySet = () =>
  new Set(buildAllExpectedSchedulePayloads().map(integrityScheduleKey));

export const partitionSchedulesByExpectation = (schedules) => {
  const expectedKeys = buildExpectedScheduleKeySet();
  const expected = [];
  const unexpected = [];

  for (const schedule of schedules) {
    const key = integrityScheduleKey(schedule);
    if (expectedKeys.has(key)) {
      expected.push(schedule);
    } else {
      unexpected.push(schedule);
    }
  }

  return { expected, unexpected, expectedKeys };
};
