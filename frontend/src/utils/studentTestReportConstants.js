export const DEFAULT_MAX_MARKS = 10;
export const PASS_PERCENTAGE = 50;
export const ATTENDANCE_PRESENT = 'P';
export const ATTENDANCE_ABSENT = 'A';
export const DEFAULT_ATTENDANCE = ATTENDANCE_PRESENT;

const ABSENT_TOKENS = new Set(['a', 'ab', 'abs', 'absent', 'absence', 'absentee']);
const LONG_AB_PATTERN = /\blong[\s._\-–—]*ab\b/i;
const ABSENT_SHORT_PATTERN = /^ab$/i;

const normalizeLegacyRemark = (value) => String(value || '').trim().toLowerCase();

export const isLegacyAbsentRemark = (value) => {
  const trimmed = String(value || '').trim();
  const raw = normalizeLegacyRemark(value);
  if (!raw) return false;

  if (ABSENT_SHORT_PATTERN.test(trimmed) || LONG_AB_PATTERN.test(trimmed)) return true;

  const compact = raw.replace(/[^a-z]/g, '');
  if (ABSENT_TOKENS.has(compact) || compact.startsWith('absent')) return true;

  const tokens = raw.split(/[^a-z]+/).filter(Boolean);
  if (tokens.some(
    (token) => ABSENT_TOKENS.has(token) || token.startsWith('absent')
  )) {
    return true;
  }

  // Hyphenated or spaced forms like "long-ab", "long -ab", "long_ab"
  return /^long[\s._\-–—]+ab$/i.test(trimmed);
};

export const resolveAttendance = (reportOrValue, legacyRemarks) => {
  if (reportOrValue && typeof reportOrValue === 'object') {
    if (reportOrValue.attendance === ATTENDANCE_ABSENT) return ATTENDANCE_ABSENT;
    if (reportOrValue.attendance === ATTENDANCE_PRESENT) return ATTENDANCE_PRESENT;
    if (isLegacyAbsentRemark(reportOrValue.remarks)) return ATTENDANCE_ABSENT;
    return DEFAULT_ATTENDANCE;
  }

  const value = String(reportOrValue || '').trim().toUpperCase();
  if (value === ATTENDANCE_ABSENT) return ATTENDANCE_ABSENT;
  if (value === ATTENDANCE_PRESENT) return ATTENDANCE_PRESENT;
  if (isLegacyAbsentRemark(legacyRemarks ?? reportOrValue)) return ATTENDANCE_ABSENT;
  return DEFAULT_ATTENDANCE;
};

export const isAbsent = (attendance) => resolveAttendance(attendance) === ATTENDANCE_ABSENT;

export const computePercentage = (marksObtained, maxMarks, attendance) => {
  if (isAbsent(attendance)) return null;
  if (marksObtained === '' || marksObtained == null || !maxMarks) return null;
  const marks = Number(marksObtained);
  const max = Number(maxMarks);
  if (Number.isNaN(marks) || Number.isNaN(max) || !max) return null;
  return Math.round((marks / max) * 1000) / 10;
};

export const formatPassStatus = (marksObtained, maxMarks, attendance) => {
  if (isAbsent(attendance)) return 'Absent';
  const pct = computePercentage(marksObtained, maxMarks, attendance);
  if (pct == null) return 'Pending';
  return pct >= PASS_PERCENTAGE ? 'Pass' : 'Fail';
};

const WHOLE_NUMBER_PATTERN = /^\d+$/;

export const sanitizeWholeNumberInput = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\D/g, '');
};

/** Round stored decimal marks up to the next whole number for display and save. */
export const roundUpStoredMark = (value) => {
  if (value === '' || value == null) return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) return '';
  return String(Math.ceil(numeric));
};

export const normalizeStoredMarkDraft = ({ marksObtained, maxMarks, attendance }) => {
  if (resolveAttendance(attendance) === ATTENDANCE_ABSENT) {
    return {
      marksObtained: '',
      maxMarks: roundUpStoredMark(maxMarks) || String(DEFAULT_MAX_MARKS),
    };
  }
  return {
    marksObtained: roundUpStoredMark(marksObtained),
    maxMarks: roundUpStoredMark(maxMarks) || String(DEFAULT_MAX_MARKS),
  };
};

export const validateWholeNumberMark = (
  value,
  { required = true, min = 0, max = null, label = 'Marks' } = {}
) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return required
      ? { valid: false, message: `${label} required for present students` }
      : { valid: true, value: '' };
  }
  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) {
    return { valid: false, message: `${label} must be a whole number (no decimals)` };
  }
  const numeric = Number(trimmed);
  if (numeric < min) {
    return { valid: false, message: `${label} must be at least ${min}` };
  }
  if (max != null && numeric > max) {
    return { valid: false, message: `${label} cannot exceed ${max}` };
  }
  return { valid: true, value: numeric };
};

export const buildMarkEntryFieldKey = (studentId, field) => `${studentId}:${field}`;

export const isMarkEntryComplete = (draft) => {
  const attendance = resolveAttendance(draft?.attendance);
  if (attendance === ATTENDANCE_ABSENT) return true;
  return String(draft?.marksObtained ?? '').trim() !== '';
};

export const MARKS_FILTER_OPTIONS = [
  { value: 'any', label: 'All scores' },
  { value: 'pending', label: 'Pending' },
  { value: 'eq', label: 'Equal to' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'At least' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'At most' },
];

export const matchesMarksFilter = (draft, operator, rawValue) => {
  if (!operator || operator === 'any') return true;
  const attendance = resolveAttendance(draft?.attendance);
  const marksObtained = draft?.marksObtained;
  if (operator === 'pending') {
    return attendance !== ATTENDANCE_ABSENT && String(marksObtained ?? '').trim() === '';
  }
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) return true;
  if (attendance === ATTENDANCE_ABSENT || marksObtained === '' || marksObtained == null) return false;
  const marks = Number(marksObtained);
  const target = Number(trimmed);
  if (Number.isNaN(marks) || Number.isNaN(target)) return false;
  if (operator === 'eq') return marks === target;
  if (operator === 'gt') return marks > target;
  if (operator === 'gte') return marks >= target;
  if (operator === 'lt') return marks < target;
  if (operator === 'lte') return marks <= target;
  return true;
};

export const validateMarkEntryDrafts = (students, drafts) => {
  const errors = {};
  let firstTarget = null;

  students.forEach((row) => {
    const draft = drafts[row._id] || {};
    const attendance = resolveAttendance(draft.attendance);
    if (attendance === ATTENDANCE_ABSENT) return;
    if (!isMarkEntryComplete(draft)) return;

    const maxResult = validateWholeNumberMark(draft.maxMarks, {
      required: true,
      min: 1,
      label: 'Out of',
    });
    if (!maxResult.valid) {
      const key = buildMarkEntryFieldKey(row._id, 'maxMarks');
      errors[key] = maxResult.message;
      if (!firstTarget) {
        firstTarget = { studentId: row._id, field: 'maxMarks', studentName: row.name };
      }
    }

    const maxMarks = maxResult.valid ? maxResult.value : Number(draft.maxMarks) || DEFAULT_MAX_MARKS;
    const marksResult = validateWholeNumberMark(draft.marksObtained, {
      required: true,
      min: 0,
      max: maxMarks,
      label: 'Marks',
    });
    if (!marksResult.valid) {
      const key = buildMarkEntryFieldKey(row._id, 'marksObtained');
      errors[key] = marksResult.message;
      if (!firstTarget) {
        firstTarget = { studentId: row._id, field: 'marksObtained', studentName: row.name };
      }
    }
  });

  return { errors, firstTarget };
};

export const blockNumberInputWheel = (event) => {
  event.currentTarget.blur();
};

export const blockDecimalNumberKeys = (event) => {
  if (['.', ',', 'e', 'E', '+', '-'].includes(event.key)) {
    event.preventDefault();
  }
};
