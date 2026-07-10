import FeedbackForm from '../models/FeedbackForm.js';
import FeedbackResponse from '../models/FeedbackResponse.js';
import {
  currentMonthKey,
  DEFAULT_FEEDBACK_FIELDS,
  generatePublicSlug,
} from '../utils/feedbackDefaults.js';

const extractRating = (answers = []) => {
  const ratingAnswer = answers.find((a) => a.fieldId === 'rating' || a.label?.toLowerCase().includes('rating'));
  const value = Number(ratingAnswer?.value);
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : null;
};

const extractAnswer = (answers, fieldId) => {
  const match = answers.find((a) => a.fieldId === fieldId);
  return match?.value != null ? String(match.value).trim() : '';
};

const formatMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

export const getFeedbackSummary = async (req, res) => {
  const monthKey = currentMonthKey();

  const [allResponses, monthResponses, publishedForms] = await Promise.all([
    FeedbackResponse.find({ rating: { $gte: 1, $lte: 5 } }).select('rating monthKey createdAt'),
    FeedbackResponse.find({ monthKey, rating: { $gte: 1, $lte: 5 } }).select('rating createdAt'),
    FeedbackForm.find({ status: 'published' }).sort({ monthKey: -1 }).limit(6).select('monthKey title publishedAt'),
  ]);

  const avg = (items) => {
    if (!items.length) return null;
    const sum = items.reduce((acc, item) => acc + item.rating, 0);
    return Math.round((sum / items.length) * 10) / 10;
  };

  res.json({
    overallAverage: avg(allResponses),
    overallCount: allResponses.length,
    currentMonth: {
      key: monthKey,
      label: formatMonthLabel(monthKey),
      average: avg(monthResponses),
      count: monthResponses.length,
    },
    recentMonths: publishedForms.map((form) => ({
      monthKey: form.monthKey,
      label: formatMonthLabel(form.monthKey),
      title: form.title,
      publishedAt: form.publishedAt,
    })),
  });
};

export const getFeedbackResponses = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.month) filter.monthKey = req.query.month;

  const [responses, total] = await Promise.all([
    FeedbackResponse.find(filter)
      .populate('form', 'title monthKey')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    FeedbackResponse.countDocuments(filter),
  ]);

  res.json({
    responses: responses.map((r) => ({
      id: r._id,
      monthKey: r.monthKey,
      monthLabel: formatMonthLabel(r.monthKey),
      formTitle: r.form?.title || '',
      studentName: r.studentName,
      rollNumber: r.rollNumber,
      rating: r.rating,
      comments: r.comments,
      answers: r.answers,
      submittedAt: r.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  });
};

export const getFeedbackForms = async (req, res) => {
  const forms = await FeedbackForm.find()
    .sort({ monthKey: -1 })
    .populate('createdBy', 'name email');
  res.json(forms);
};

export const getCurrentMonthForm = async (req, res) => {
  const monthKey = currentMonthKey();
  let form = await FeedbackForm.findOne({ monthKey });
  res.json({
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    form,
  });
};

export const createCurrentMonthForm = async (req, res) => {
  const monthKey = currentMonthKey();
  const existing = await FeedbackForm.findOne({ monthKey });
  if (existing) {
    return res.status(400).json({ message: 'A feedback form for this month already exists' });
  }

  const form = await FeedbackForm.create({
    monthKey,
    title: `Feedback - ${formatMonthLabel(monthKey)}`,
    description: 'Please share your feedback for this month.',
    fields: DEFAULT_FEEDBACK_FIELDS,
    createdBy: req.user._id,
  });

  res.status(201).json(form);
};

export const updateFeedbackForm = async (req, res) => {
  const form = await FeedbackForm.findById(req.params.id);
  if (!form) {
    return res.status(404).json({ message: 'Feedback form not found' });
  }
  if (form.status === 'published') {
    return res.status(400).json({ message: 'Published forms cannot be edited. Create a new month form instead.' });
  }

  const { title, description, fields } = req.body;
  if (title !== undefined) form.title = String(title).trim();
  if (description !== undefined) form.description = String(description).trim();
  if (fields !== undefined) {
    form.fields = fields.map((field, index) => ({
      id: field.id || `field_${index}`,
      type: field.type,
      label: String(field.label || '').trim(),
      required: Boolean(field.required),
      options: field.options || [],
      order: field.order ?? index,
    }));
  }

  await form.save();
  res.json(form);
};

export const publishFeedbackForm = async (req, res) => {
  const form = await FeedbackForm.findById(req.params.id);
  if (!form) {
    return res.status(404).json({ message: 'Feedback form not found' });
  }
  if (!form.fields?.length) {
    return res.status(400).json({ message: 'Add at least one question before publishing' });
  }

  if (!form.publicSlug) {
    let slug = generatePublicSlug();
    let taken = await FeedbackForm.findOne({ publicSlug: slug });
    while (taken) {
      slug = generatePublicSlug();
      taken = await FeedbackForm.findOne({ publicSlug: slug });
    }
    form.publicSlug = slug;
  }

  form.status = 'published';
  form.publishedAt = new Date();
  await form.save();

  const publicPath = `/f/${form.publicSlug}`;
  res.json({
    form,
    publicPath,
    publicUrl: publicPath,
  });
};

export const getPublicFeedbackForm = async (req, res) => {
  const form = await FeedbackForm.findOne({
    publicSlug: req.params.slug,
    status: 'published',
  });

  if (!form) {
    return res.status(404).json({ message: 'Feedback form not found or not published' });
  }

  res.json({
    title: form.title,
    description: form.description,
    monthKey: form.monthKey,
    monthLabel: formatMonthLabel(form.monthKey),
    fields: form.fields.sort((a, b) => a.order - b.order),
  });
};

export const submitPublicFeedback = async (req, res) => {
  const form = await FeedbackForm.findOne({
    publicSlug: req.params.slug,
    status: 'published',
  });

  if (!form) {
    return res.status(404).json({ message: 'Feedback form not found or not published' });
  }

  const { answers } = req.body;
  if (!Array.isArray(answers) || !answers.length) {
    return res.status(400).json({ message: 'Please answer the form questions' });
  }

  const normalizedAnswers = form.fields.map((field) => {
    const submitted = answers.find((a) => a.fieldId === field.id);
    return {
      fieldId: field.id,
      label: field.label,
      value: submitted?.value ?? '',
    };
  });

  for (const field of form.fields) {
    if (!field.required) continue;
    const answer = normalizedAnswers.find((a) => a.fieldId === field.id);
    const value = answer?.value;
    if (value === '' || value === null || value === undefined) {
      return res.status(400).json({ message: `"${field.label}" is required` });
    }
  }

  const rating = extractRating(normalizedAnswers);
  const response = await FeedbackResponse.create({
    form: form._id,
    monthKey: form.monthKey,
    answers: normalizedAnswers,
    rating,
    studentName: extractAnswer(normalizedAnswers, 'student_name'),
    rollNumber: extractAnswer(normalizedAnswers, 'roll_number'),
    comments: extractAnswer(normalizedAnswers, 'comments'),
  });

  res.status(201).json({
    message: 'Thank you for your feedback',
    id: response._id,
  });
};
