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
    id: 'rating',
    type: 'rating',
    label: 'Ratings',
    required: true,
    order: 2,
  },
  {
    id: 'comments',
    type: 'paragraph',
    label: 'Comments',
    required: false,
    order: 3,
  },
];

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
