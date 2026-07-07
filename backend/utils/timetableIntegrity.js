import { timesOverlap } from './timetableSlots.js';

export const integrityScheduleKey = (schedule) =>
  [
    schedule.trainerCode,
    schedule.semester || 'III',
    schedule.day,
    schedule.slot || `${schedule.startTime}-${schedule.endTime}`,
    schedule.department,
    schedule.section,
    schedule.subjectCode || '',
  ].join('|');

export const classSlotKey = (schedule) =>
  [
    schedule.department,
    schedule.section,
    schedule.semester || 'III',
    schedule.day,
  ].join('|');

export const trainerDayKey = (schedule) =>
  `${schedule.trainerCode}|${schedule.day}`;

export const formatScheduleLabel = (schedule) =>
  `${schedule.trainerCode} ${schedule.day} ${schedule.startTime}-${schedule.endTime} ` +
  `${schedule.department} ${schedule.section} (${schedule.subjectCode || 'no subject'})`;

const findOverlapsInGroups = (schedules, groupKeyFn) => {
  const groups = new Map();

  for (const schedule of schedules) {
    const key = groupKeyFn(schedule);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(schedule);
  }

  const conflicts = [];

  for (const [groupKey, entries] of groups) {
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const left = entries[i];
        const right = entries[j];
        if (
          timesOverlap(left.startTime, left.endTime, right.startTime, right.endTime)
        ) {
          conflicts.push({ groupKey, left, right });
        }
      }
    }
  }

  return conflicts;
};

export const findTrainerTimeOverlaps = (schedules) =>
  findOverlapsInGroups(schedules, trainerDayKey);

export const findClassTimeOverlaps = (schedules) =>
  findOverlapsInGroups(schedules, classSlotKey);

export const findResolvedTrainerTimeOverlaps = (schedules, trainerIdByCode) => {
  const resolved = schedules
    .map((schedule) => ({
      ...schedule,
      resolvedTrainerId: trainerIdByCode.get(schedule.trainerCode) || schedule.trainerCode,
    }))
    .filter((schedule) => schedule.resolvedTrainerId);

  return findOverlapsInGroups(
    resolved,
    (schedule) => `${schedule.resolvedTrainerId}|${schedule.day}`
  );
};

export const createIntegrityChecker = () => {
  const failures = [];
  const warnings = [];

  const check = (name, condition, detail = '', { warn = false } = {}) => {
    if (condition) {
      console.log(`PASS: ${name}`);
      return true;
    }

    const item = { name, detail: detail || name };
    if (warn) {
      warnings.push(item);
      console.warn(`WARN: ${name}${detail ? ` — ${detail}` : ''}`);
    } else {
      failures.push(item);
      console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    }
    return false;
  };

  return {
    check,
    failures,
    warnings,
    passed: () => failures.length === 0,
  };
};

export const summarizeIntegrityResults = ({ failures, warnings }) => {
  console.log('\n--- Summary ---');
  console.log(`Failures: ${failures.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (failures.length) {
    failures.forEach((item) => console.error(`- ${item.name}: ${item.detail}`));
    return 1;
  }

  if (warnings.length) {
    warnings.forEach((item) => console.warn(`- ${item.name}: ${item.detail}`));
  }

  console.log('All timetable integrity checks passed.');
  return 0;
};
