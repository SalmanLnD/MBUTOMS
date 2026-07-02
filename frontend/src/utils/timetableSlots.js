import { formatTimeRange } from './scheduleUtils.js';

export const DEFAULT_SLOT_TIMINGS = {
  s1: { startTime: '09:00', endTime: '10:50' },
  s2: { startTime: '11:10', endTime: '13:00' },
  s3: { startTime: '14:15', endTime: '16:05' },
};

export const SLOT_KEYS = ['S1', 'S2', 'S3'];

export const slotKeyToField = (key) => key.toLowerCase();

export const getSubjectSlotDefinitions = (subject) =>
  SLOT_KEYS.map((key) => {
    const field = slotKeyToField(key);
    const timing = subject?.slotTimings?.[field] || DEFAULT_SLOT_TIMINGS[field];
    return {
      key,
      startTime: timing.startTime,
      endTime: timing.endTime,
      label: formatTimeRange(timing.startTime, timing.endTime),
    };
  });

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
  if (start < 11 * 60) return 'S1';
  if (start < 14 * 60) return 'S2';
  return 'S3';
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

  const period = inferSchedulePeriod(schedule);
  return slotDefinitions.find((slot) => slot.key === period);
};

export const getSlotTimesForSubject = (subject, slotKey) => {
  const field = slotKeyToField(slotKey);
  const timing = subject?.slotTimings?.[field] || DEFAULT_SLOT_TIMINGS[field];
  return {
    startTime: timing.startTime,
    endTime: timing.endTime,
  };
};

const SLOT_FIELDS = ['s1', 's2', 's3'];

export const normalizeSlotTimings = (slotTimings) => ({
  s1: { ...DEFAULT_SLOT_TIMINGS.s1, ...slotTimings?.s1 },
  s2: { ...DEFAULT_SLOT_TIMINGS.s2, ...slotTimings?.s2 },
  s3: { ...DEFAULT_SLOT_TIMINGS.s3, ...slotTimings?.s3 },
});

export const serializeSlotTimings = (slotTimings) => {
  const normalized = normalizeSlotTimings(slotTimings);
  return SLOT_FIELDS.map((key) => {
    const slot = normalized[key];
    return `${key}:${slot.startTime}-${slot.endTime}`;
  }).join('|');
};

export const areSlotTimingsEqual = (left, right) =>
  serializeSlotTimings(left) === serializeSlotTimings(right);

export const formatSlotTimingsSummary = (slotTimings) => {
  const normalized = normalizeSlotTimings(slotTimings);
  return SLOT_FIELDS.map((key) => {
    const slot = normalized[key];
    return `${key.toUpperCase()} ${slot.startTime}–${slot.endTime}`;
  }).join(', ');
};

export const groupSubjectsBySlotTimings = (subjects, excludeSubjectId = '') => {
  const groups = new Map();

  subjects.forEach((subject) => {
    if (excludeSubjectId && subject._id === excludeSubjectId) return;

    const key = serializeSlotTimings(subject.slotTimings);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        slotTimings: normalizeSlotTimings(subject.slotTimings),
        summary: formatSlotTimingsSummary(subject.slotTimings),
        subjects: [],
      });
    }
    groups.get(key).subjects.push(subject);
  });

  return [...groups.values()].sort((a, b) => a.summary.localeCompare(b.summary));
};

export const findSubjectsWithSimilarTimings = (subjects, slotTimings, excludeSubjectId = '') =>
  subjects.filter(
    (subject) =>
      subject._id !== excludeSubjectId && areSlotTimingsEqual(subject.slotTimings, slotTimings)
  );

export const hasMultipleSubjectTimings = (subjects) => {
  if (subjects.length <= 1) return false;
  const keys = new Set(subjects.map((subject) => serializeSlotTimings(subject.slotTimings)));
  return keys.size > 1;
};

export const shouldShowTimingsInCells = (subjects, selectedSubject) => {
  if (selectedSubject) return false;
  return hasMultipleSubjectTimings(subjects);
};

