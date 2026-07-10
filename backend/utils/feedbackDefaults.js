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
    id: 'trainer',
    type: 'trainer_select',
    label: 'Trainer name',
    required: true,
    order: 2,
  },
  {
    id: 'rating',
    type: 'rating',
    label: 'Ratings',
    required: true,
    order: 3,
  },
  {
    id: 'comments',
    type: 'paragraph',
    label: 'Comments',
    required: true,
    order: 4,
  },
];

/** Ensure draft forms include the latest default questions and required flags. */
export const mergeDefaultFeedbackFields = (existingFields = []) => {
  const existingById = new Map(existingFields.map((field) => [field.id, field]));

  const mergedDefaults = DEFAULT_FEEDBACK_FIELDS.map((defaultField) => {
    const existing = existingById.get(defaultField.id);
    if (!existing) return { ...defaultField };
    return {
      ...existing,
      type: defaultField.type,
      required: defaultField.required,
      label: existing.label?.trim() || defaultField.label,
      order: defaultField.order,
    };
  });

  const extraFields = existingFields.filter(
    (field) => !DEFAULT_FEEDBACK_FIELDS.some((defaultField) => defaultField.id === field.id)
  );

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
