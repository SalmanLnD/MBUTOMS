export const FEEDBACK_SEMESTER_OPTIONS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export const DEFAULT_FEEDBACK_FIELDS = [
  {
    id: 'student_name',
    type: 'short_text',
    label: 'Name of the student',
    required: true,
    order: 0,
  },
  {
    id: 'roll_number',
    type: 'short_text',
    label: 'Full roll number of the student',
    required: true,
    order: 1,
  },
  {
    id: 'student_class',
    type: 'class_select',
    label: 'Class',
    required: true,
    order: 2,
  },
  {
    id: 'semester',
    type: 'semester_select',
    label: 'Semester',
    required: true,
    order: 3,
  },
  {
    id: 'trainer',
    type: 'trainer_select',
    label: 'Trainer name',
    required: true,
    order: 4,
  },
  {
    id: 'rating',
    type: 'rating',
    label: 'Ratings',
    required: true,
    order: 5,
  },
  {
    id: 'comments',
    type: 'paragraph',
    label: 'Comments',
    required: true,
    order: 6,
  },
];

const normalizeLabel = (field) => String(field?.label || '').trim().toLowerCase();

const isClassField = (field) => {
  if (!field) return false;
  if (field.id === 'student_class' || field.type === 'class_select') return true;
  const label = normalizeLabel(field);
  return label === 'class' || label.includes('class name') || label.includes('select class');
};

const isSemesterField = (field) => {
  if (!field) return false;
  if (field.id === 'semester' || field.type === 'semester_select') return true;
  const label = normalizeLabel(field);
  return label === 'semester' || label.startsWith('semester');
};

export const formatFeedbackClassLabel = (cls, classes = []) => {
  const base = `${cls.department || ''} ${cls.section || ''}`.trim();
  if (!base) return '';
  const duplicates = classes.filter(
    (item) => `${item.department || ''} ${item.section || ''}`.trim() === base
  );
  if (duplicates.length > 1 && cls.currentSemester) {
    return `${base} · Sem ${cls.currentSemester}`;
  }
  return base;
};

/** Ensure draft forms include the latest default questions and required flags. */
export const mergeDefaultFeedbackFields = (existingFields = []) => {
  const existingById = new Map(existingFields.map((field) => [field.id, field]));
  const used = new Set();

  const takeMatching = (defaultField, matcher) => {
    const byId = existingById.get(defaultField.id);
    if (byId) {
      used.add(byId);
      return byId;
    }
    const matched = existingFields.find((field) => !used.has(field) && matcher(field));
    if (matched) used.add(matched);
    return matched;
  };

  const mergedDefaults = DEFAULT_FEEDBACK_FIELDS.map((defaultField) => {
    const matcher = defaultField.id === 'student_class'
      ? isClassField
      : defaultField.id === 'semester'
        ? isSemesterField
        : () => false;
    const existing = takeMatching(defaultField, matcher);
    if (!existing) return { ...defaultField };
    return {
      ...existing,
      id: defaultField.id,
      type: defaultField.type,
      required: defaultField.required,
      label: existing.label?.trim() || defaultField.label,
      order: defaultField.order,
    };
  });

  const extraFields = existingFields.filter((field) => !used.has(field));

  return [...mergedDefaults, ...extraFields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export const currentMonthKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const generatePublicSlug = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i += 1) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
};
