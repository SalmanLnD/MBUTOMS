import { SOC_FOUR_SLOT_TIMINGS } from './subjectSlotTimings.js';

export const DEFAULT_SLOT_TIMINGS = SOC_FOUR_SLOT_TIMINGS;

export const SLOT_KEYS = ['S1', 'S2', 'S3', 'S4'];
export const SLOT_FIELD_KEYS = ['s1', 's2', 's3', 's4'];
export const MAX_SLOT_COUNT = 4;

export const slotKeyToField = (key) => key.toLowerCase();

export const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const timesOverlap = (startA, endA, startB, endB) =>
  parseTimeToMinutes(startA) < parseTimeToMinutes(endB) &&
  parseTimeToMinutes(endA) > parseTimeToMinutes(startB);

export const normalizeSlotTimings = (input = {}) => ({
  s1: {
    startTime: input.s1?.startTime || DEFAULT_SLOT_TIMINGS.s1.startTime,
    endTime: input.s1?.endTime || DEFAULT_SLOT_TIMINGS.s1.endTime,
  },
  s2: {
    startTime: input.s2?.startTime || DEFAULT_SLOT_TIMINGS.s2.startTime,
    endTime: input.s2?.endTime || DEFAULT_SLOT_TIMINGS.s2.endTime,
  },
  s3: {
    startTime: input.s3?.startTime || DEFAULT_SLOT_TIMINGS.s3.startTime,
    endTime: input.s3?.endTime || DEFAULT_SLOT_TIMINGS.s3.endTime,
  },
  s4: {
    startTime: input.s4?.startTime || DEFAULT_SLOT_TIMINGS.s4.startTime,
    endTime: input.s4?.endTime || DEFAULT_SLOT_TIMINGS.s4.endTime,
  },
});

export const getSlotTimes = (slotTimings, slot) => {
  const field = slotKeyToField(slot);
  const timings = slotTimings?.[field] || DEFAULT_SLOT_TIMINGS[field];
  return {
    startTime: timings.startTime,
    endTime: timings.endTime,
  };
};
