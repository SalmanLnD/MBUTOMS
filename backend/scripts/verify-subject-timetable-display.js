import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Subject from '../models/Subject.js';
import {
  SUBJECT_SLOT_PROFILES,
  getSubjectSlotProfile,
  getSubjectSlotCount,
} from '../utils/subjectSlotTimings.js';
import { SLOT_KEYS } from '../utils/timetableSlots.js';
import { createIntegrityChecker, summarizeIntegrityResults } from '../utils/timetableIntegrity.js';

dotenv.config();

const slotField = (key) => key.toLowerCase();

const getDisplaySlotDefinitions = (subject) => {
  const profile = getSubjectSlotProfile(subject?.code);
  const slotCount = getSubjectSlotCount(subject);
  return SLOT_KEYS.slice(0, slotCount).map((key) => {
    const field = slotField(key);
    const timing =
      profile?.timings?.[field] ||
      subject?.slotTimings?.[field];
    return {
      key,
      startTime: timing?.startTime,
      endTime: timing?.endTime,
    };
  });
};

const matchScheduleToDisplaySlot = (schedule, slotDefinitions) => {
  if (schedule.slot && SLOT_KEYS.includes(schedule.slot)) {
    const bySlot = slotDefinitions.find((slot) => slot.key === schedule.slot);
    if (bySlot) return bySlot;
  }

  return slotDefinitions.find(
    (slot) => slot.startTime === schedule.startTime && slot.endTime === schedule.endTime
  );
};

const checker = createIntegrityChecker();

await mongoose.connect(process.env.MONGODB_URI);

const [subjects, schedules] = await Promise.all([
  Subject.find().lean(),
  Schedule.find().lean(),
]);

const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject]));

console.log(`Checking ${subjects.length} subject(s) and ${schedules.length} schedule(s).\n`);

for (const [code, profile] of Object.entries(SUBJECT_SLOT_PROFILES)) {
  const subject = subjectByCode.get(code);
  if (!subject) {
    checker.check(`Subject exists: ${code}`, false, code);
    continue;
  }

  checker.check(
    `${code} slotCount matches profile`,
    subject.slotCount === profile.slotCount,
    `DB=${subject.slotCount}, profile=${profile.slotCount}`
  );

  for (let i = 0; i < profile.slotCount; i += 1) {
    const key = SLOT_KEYS[i];
    const field = slotField(key);
    const expected = profile.timings[field];
    const actual = subject.slotTimings?.[field];
    checker.check(
      `${code} ${key} timing in subject record`,
      actual?.startTime === expected.startTime && actual?.endTime === expected.endTime,
      `DB=${actual?.startTime}-${actual?.endTime}, profile=${expected.startTime}-${expected.endTime}`
    );
  }
}

const scheduleMismatches = [];
const displayMismatches = [];
const unmappedSchedules = [];

for (const schedule of schedules) {
  const subject = subjectByCode.get(schedule.subjectCode);
  if (!subject) {
    unmappedSchedules.push(`${schedule.trainerCode} ${schedule.day} ${schedule.subjectCode}`);
    continue;
  }

  const profile = getSubjectSlotProfile(subject.code);
  if (profile && schedule.slot) {
    const field = slotField(schedule.slot);
    const expected = profile.timings[field];
    if (expected) {
      const timeMatches =
        schedule.startTime === expected.startTime && schedule.endTime === expected.endTime;
      if (!timeMatches) {
        scheduleMismatches.push(
          `${schedule.trainerCode} ${schedule.day} ${schedule.slot} ${schedule.subjectCode}: ` +
          `schedule=${schedule.startTime}-${schedule.endTime}, ` +
          `subject=${expected.startTime}-${expected.endTime}`
        );
      }
    }
  }

  const displaySlots = getDisplaySlotDefinitions(subject);
  const matchedColumn = matchScheduleToDisplaySlot(schedule, displaySlots);
  if (!matchedColumn) {
    displayMismatches.push(
      `${schedule.trainerCode} ${schedule.day} ${schedule.slot || ''} ` +
      `${schedule.startTime}-${schedule.endTime} (${schedule.subjectCode}) -> no column`
    );
    continue;
  }

  const headerLabel = `${matchedColumn.startTime} – ${matchedColumn.endTime}`;
  const scheduleLabel = `${schedule.startTime} – ${schedule.endTime}`;
  if (headerLabel !== scheduleLabel) {
    displayMismatches.push(
      `${schedule.trainerCode} ${schedule.day} ${schedule.slot}: ` +
      `column header "${headerLabel}" vs cell "${scheduleLabel}"`
    );
  }
}

checker.check(
  'Every schedule subjectCode resolves to a subject',
  unmappedSchedules.length === 0,
  unmappedSchedules.slice(0, 5).join('; ')
);

checker.check(
  'Schedule times match subject slot profile',
  scheduleMismatches.length === 0,
  scheduleMismatches.slice(0, 8).join('; ')
);

checker.check(
  'Every schedule maps to a matching timetable column header',
  displayMismatches.length === 0,
  displayMismatches.slice(0, 8).join('; ')
);

const trainersWithSchedules = [...new Set(schedules.map((schedule) => schedule.trainerCode))];
for (const trainerCode of trainersWithSchedules) {
  const trainerSchedules = schedules.filter((schedule) => schedule.trainerCode === trainerCode);
  const codes = [...new Set(trainerSchedules.map((schedule) => schedule.subjectCode).filter(Boolean))];
  if (codes.length !== 1) continue;

  const subject = subjectByCode.get(codes[0]);
  const columns = getDisplaySlotDefinitions(subject);
  const columnLabels = columns.map((slot) => `${slot.key}:${slot.startTime}-${slot.endTime}`).join(', ');
  const unplaced = trainerSchedules.filter(
    (schedule) => !matchScheduleToDisplaySlot(schedule, columns)
  );

  checker.check(
    `Trainer ${trainerCode} grid columns (${codes[0]})`,
    unplaced.length === 0,
    `columns=[${columnLabels}], unplaced=${unplaced.length}`
  );
}

await mongoose.disconnect();

const exitCode = summarizeIntegrityResults(checker);
process.exit(exitCode);
