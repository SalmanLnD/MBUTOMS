import { formatTimeRange } from './scheduleUtils.js';
import { SOC_FOUR_SLOT_TIMINGS, getSubjectSlotCount, getSubjectSlotProfile } from './subjectSlotTimings.js';

export const DEFAULT_SLOT_TIMINGS = SOC_FOUR_SLOT_TIMINGS;

export const SLOT_KEYS = ['S1', 'S2', 'S3', 'S4'];
export const SLOT_FIELD_KEYS = ['s1', 's2', 's3', 's4'];
export const MAX_SLOT_COUNT = 4;

export const slotKeyToField = (key) => key.toLowerCase();

export const getActiveSlotKeys = (subject) =>
  SLOT_KEYS.slice(0, getSubjectSlotCount(subject));

export const getSubjectSlotDefinitions = (subject) => {
  const profile = getSubjectSlotProfile(subject?.code);
  return getActiveSlotKeys(subject).map((key) => {
    const field = slotKeyToField(key);
    const timing =
      profile?.timings?.[field] ||
      subject?.slotTimings?.[field] ||
      DEFAULT_SLOT_TIMINGS[field];
    return {
      key,
      startTime: timing.startTime,
      endTime: timing.endTime,
      label: formatTimeRange(timing.startTime, timing.endTime),
    };
  });
};

export const getDefaultSlotDefinitions = () => getSubjectSlotDefinitions(null);

export const parseTimeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const inferSchedulePeriod = (schedule) => {
  if (schedule.slot && SLOT_KEYS.includes(schedule.slot)) {
    return schedule.slot;
  }

  const start = parseTimeToMinutes(schedule.startTime);
  if (start < 10 * 60 + 30) return 'S1';
  if (start < 13 * 60 + 45) return 'S2';
  if (start < 15 * 60 + 45) return 'S3';
  return 'S4';
};

export const getPeriodOnlySlotDefinitions = () =>
  SLOT_KEYS.map((key) => ({
    key,
    periodOnly: true,
    label: key,
  }));

export const matchScheduleToSlot = (schedule, slotDefinitions) => {
  if (slotDefinitions.every((slot) => slot.periodOnly)) {
    const period = inferSchedulePeriod(schedule);
    return slotDefinitions.find((slot) => slot.key === period);
  }

  if (schedule.slot && SLOT_KEYS.includes(schedule.slot)) {
    const bySlot = slotDefinitions.find((slot) => slot.key === schedule.slot);
    if (bySlot) return bySlot;
  }

  const byTime = slotDefinitions.find(
    (slot) => slot.startTime === schedule.startTime && slot.endTime === schedule.endTime
  );
  if (byTime) return byTime;

  if (schedule.slot && SLOT_KEYS.includes(schedule.slot)) {
    return slotDefinitions.find((slot) => slot.key === schedule.slot);
  }

  const period = inferSchedulePeriod(schedule);
  return slotDefinitions.find((slot) => slot.key === period);
};

export const getSlotTimesForSubject = (subject, slotKey) => {
  const field = slotKeyToField(slotKey);
  const profile = getSubjectSlotProfile(subject?.code);
  const timing =
    profile?.timings?.[field] ||
    subject?.slotTimings?.[field] ||
    DEFAULT_SLOT_TIMINGS[field];
  return {
    startTime: timing.startTime,
    endTime: timing.endTime,
  };
};

const SLOT_FIELDS = SLOT_FIELD_KEYS;

export const normalizeSlotTimings = (slotTimings) => ({
  s1: { ...DEFAULT_SLOT_TIMINGS.s1, ...slotTimings?.s1 },
  s2: { ...DEFAULT_SLOT_TIMINGS.s2, ...slotTimings?.s2 },
  s3: { ...DEFAULT_SLOT_TIMINGS.s3, ...slotTimings?.s3 },
  s4: { ...DEFAULT_SLOT_TIMINGS.s4, ...slotTimings?.s4 },
});

export const serializeSlotTimings = (slotTimings, slotCount = MAX_SLOT_COUNT) => {
  const normalized = normalizeSlotTimings(slotTimings);
  return `${slotCount}|${SLOT_FIELDS.slice(0, slotCount).map((key) => {
    const slot = normalized[key];
    return `${key}:${slot.startTime}-${slot.endTime}`;
  }).join('|')}`;
};

export const areSlotTimingsEqual = (left, right, slotCount = MAX_SLOT_COUNT) =>
  serializeSlotTimings(left, slotCount) === serializeSlotTimings(right, slotCount);

export const formatSlotTimingsSummary = (slotTimings, slotCount = MAX_SLOT_COUNT) => {
  const normalized = normalizeSlotTimings(slotTimings);
  return SLOT_FIELDS.slice(0, slotCount).map((key) => {
    const slot = normalized[key];
    return `${key.toUpperCase()} ${slot.startTime}–${slot.endTime}`;
  }).join(', ');
};

export const groupSubjectsBySlotTimings = (subjects, excludeSubjectId = '') => {
  const groups = new Map();

  subjects.forEach((subject) => {
    if (excludeSubjectId && subject._id === excludeSubjectId) return;

    const key = serializeSlotTimings(subject.slotTimings, subject.slotCount || MAX_SLOT_COUNT);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        slotTimings: normalizeSlotTimings(subject.slotTimings),
        slotCount: subject.slotCount || MAX_SLOT_COUNT,
        summary: formatSlotTimingsSummary(subject.slotTimings, subject.slotCount || MAX_SLOT_COUNT),
        subjects: [],
      });
    }
    groups.get(key).subjects.push(subject);
  });

  return [...groups.values()].sort((a, b) => a.summary.localeCompare(b.summary));
};

export const findSubjectsWithSimilarTimings = (subjects, slotTimings, excludeSubjectId = '', slotCount = MAX_SLOT_COUNT) =>
  subjects.filter(
    (subject) =>
      subject._id !== excludeSubjectId
      && (subject.slotCount || MAX_SLOT_COUNT) === slotCount
      && areSlotTimingsEqual(subject.slotTimings, slotTimings, slotCount)
  );

export const hasMultipleSubjectTimings = (subjects) => {
  if (subjects.length <= 1) return false;
  const keys = new Set(
    subjects.map((subject) => serializeSlotTimings(subject.slotTimings, subject.slotCount || MAX_SLOT_COUNT))
  );
  return keys.size > 1;
};

export const shouldShowTimingsInCells = (subjects, selectedSubject) => {
  if (selectedSubject) return false;
  return hasMultipleSubjectTimings(subjects);
};

