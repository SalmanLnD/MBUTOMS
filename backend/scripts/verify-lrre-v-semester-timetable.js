import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { buildTrainerSchedulesForDate } from '../utils/trainerScheduleView.js';
import {
  LRRE_SUBJECT_CODE,
  LRRE_V_SEMESTER,
  LRRE_V_TRAINER_ALLOCATIONS,
  buildExpectedScheduleRecord,
  scheduleKey,
  formatScheduleWebLabel,
} from '../utils/lrreVSemesterTimetable.js';
import { syncLrreVSemesterTimetable } from '../utils/syncLrreVSemesterTimetable.js';

dotenv.config();

const failures = [];

const check = (name, condition, detail = '') => {
  try {
    assert.ok(condition, detail || name);
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push({ name, error: error.message, detail });
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

await mongoose.connect(process.env.MONGODB_URI);

const syncResult = await syncLrreVSemesterTimetable();
console.log('Sync result:', syncResult);

const subject = await Subject.findOne({ code: LRRE_SUBJECT_CODE });
check('LRRE subject exists', Boolean(subject), LRRE_SUBJECT_CODE);

for (const [employeeId, allocation] of Object.entries(LRRE_V_TRAINER_ALLOCATIONS)) {
  const trainer = await Trainer.findOne({ employeeId });
  check(`Trainer exists: ${allocation.name}`, Boolean(trainer), employeeId);

  const dbSchedules = await Schedule.find({
    trainerCode: employeeId,
    semester: LRRE_V_SEMESTER,
    subjectCode: LRRE_SUBJECT_CODE,
  }).sort({ day: 1, startTime: 1 });

  check(
    `${allocation.name} schedule count`,
    dbSchedules.length === allocation.slots.length,
    `expected ${allocation.slots.length}, got ${dbSchedules.length}`
  );

  const expectedKeys = new Set(
    allocation.slots.map((entry) =>
      scheduleKey(buildExpectedScheduleRecord(employeeId, entry, subject._id))
    )
  );
  const actualKeys = new Set(dbSchedules.map((entry) => scheduleKey(entry)));

  check(
    `${allocation.name} exact slot mapping`,
    expectedKeys.size === actualKeys.size &&
      [...expectedKeys].every((key) => actualKeys.has(key)),
    `missing=${[...expectedKeys].filter((key) => !actualKeys.has(key)).join('; ')}`
  );

  const apiSchedules = await buildTrainerSchedulesForDate({
    trainerId: trainer?._id,
    semester: LRRE_V_SEMESTER,
  });

  check(
    `${allocation.name} API/web schedule count`,
    apiSchedules.length === allocation.slots.length,
    `API returned ${apiSchedules.length}`
  );

  for (const entry of allocation.slots) {
    const expected = buildExpectedScheduleRecord(employeeId, entry, subject._id);
    const apiMatch = apiSchedules.find(
      (schedule) =>
        schedule.day === expected.day &&
        schedule.startTime === expected.startTime &&
        schedule.department === expected.department &&
        schedule.section === expected.section
    );

    check(
      `${allocation.name} ${entry.day} ${entry.slot} ${entry.class}`,
      Boolean(apiMatch),
      'not returned by timetable API'
    );

    if (apiMatch) {
      const webLabel = formatScheduleWebLabel(apiMatch);
      check(
        `${allocation.name} web label ${entry.day} ${entry.slot}`,
        webLabel === `${expected.department} ${expected.section}`,
        `expected "${expected.department} ${expected.section}", got "${webLabel}"`
      );
    }
  }
}

const hariniSchedules = await Schedule.countDocuments({
  trainerCode: '801406',
  semester: LRRE_V_SEMESTER,
  subjectCode: LRRE_SUBJECT_CODE,
});
check(
  'Harinisree LRRE V schedule count',
  hariniSchedules === LRRE_V_TRAINER_ALLOCATIONS['801406'].slots.length,
  `expected ${LRRE_V_TRAINER_ALLOCATIONS['801406'].slots.length}, found ${hariniSchedules}`
);

await mongoose.disconnect();

console.log('\n--- Summary ---');
console.log(`Passed with ${failures.length} failure(s)`);
if (failures.length) {
  failures.forEach((item) => console.error(`- ${item.name}: ${item.error}`));
  process.exit(1);
}

console.log('All LRRE V Semester timetable checks passed.');
