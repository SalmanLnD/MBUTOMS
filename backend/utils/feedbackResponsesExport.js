import FeedbackResponse from '../models/FeedbackResponse.js';

const formatMonthLabel = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

const formatSubmittedAt = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN');
};

export const FEEDBACK_RESPONSES_EXPORT_COLUMNS = [
  'Submitted',
  'Student',
  'Roll number',
  'Trainer',
  'Trainer ID',
  'Rating',
  'Comments',
  'Form',
  'Month',
];

export const buildFeedbackResponsesExportRows = async () => {
  const responses = await FeedbackResponse.find()
    .populate('form', 'title monthKey')
    .populate('trainer', 'name employeeId')
    .sort({ createdAt: -1 })
    .lean();

  const rows = [
    FEEDBACK_RESPONSES_EXPORT_COLUMNS,
    ...responses.map((r) => [
      formatSubmittedAt(r.createdAt),
      r.studentName || '',
      r.rollNumber || '',
      r.trainer?.name || '',
      r.trainer?.employeeId || '',
      r.rating != null ? String(r.rating) : '',
      r.comments || '',
      r.form?.title || '',
      formatMonthLabel(r.monthKey),
    ]),
  ];

  return {
    rows,
    exportedAt: new Date().toISOString(),
    count: Math.max(0, rows.length - 1),
  };
};
