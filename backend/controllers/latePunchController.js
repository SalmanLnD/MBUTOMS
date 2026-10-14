import Trainer from '../models/Trainer.js';
import TrainerCompliance from '../models/TrainerCompliance.js';
import TrainerDailyAttendance from '../models/TrainerDailyAttendance.js';
import LatePunchReview from '../models/LatePunchReview.js';
import { downloadPunchPhoto } from '../services/punchPhotoDrive.js';
import { normalizeAttendanceDate, toAttendanceDateKey } from '../utils/attendanceTracking.js';
import {
  LATE_MISCONDUCT_START,
  LATE_PUNCH_SOURCES,
  isLateMisconductDate,
  isLatePunch,
  lateMarkOutcome,
  punchDistanceFromCampus,
} from '../utils/latePunch.js';
import { notifyTrainerOfLateMark } from '../utils/latePunchNotifications.js';

const monthBounds = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: normalizeAttendanceDate(`${monthKey}-01`),
    end: normalizeAttendanceDate(`${monthKey}-${String(lastDay).padStart(2, '0')}`),
  };
};

const currentMonthKey = () => toAttendanceDateKey(new Date()).slice(0, 7);

export const countPendingLatePunches = async () => {
  const effectiveStart = normalizeAttendanceDate(LATE_MISCONDUCT_START);
  const reviewedIds = await LatePunchReview.find().distinct('attendance');
  const records = await TrainerDailyAttendance.find({
    punchInSource: { $in: LATE_PUNCH_SOURCES },
    date: { $gte: effectiveStart },
    punchInAt: { $ne: null },
    ...(reviewedIds.length ? { _id: { $nin: reviewedIds } } : {}),
  }).select('punchInAt date').lean();
  return records.filter((record) => isLatePunch(record.punchInAt) && isLateMisconductDate(record.date)).length;
};

export const listLatePunches = async (req, res) => {
  const monthKey = /^\d{4}-\d{2}$/.test(String(req.query.month || ''))
    ? String(req.query.month)
    : currentMonthKey();
  const status = ['pending', 'reviewed', 'all'].includes(req.query.status)
    ? req.query.status
    : 'pending';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const { start, end } = monthBounds(monthKey);
  const effectiveStart = normalizeAttendanceDate(LATE_MISCONDUCT_START);
  const rangeStart = start > effectiveStart ? start : effectiveStart;

  if (end < effectiveStart) {
    return res.json({
      month: monthKey,
      items: [],
      pagination: { page, limit, total: 0, pages: 1 },
    });
  }

  const filter = {
    punchInSource: { $in: LATE_PUNCH_SOURCES },
    punchInAt: { $ne: null },
    date: { $gte: rangeStart, $lte: end },
  };

  const search = String(req.query.search || '').trim();
  if (search) {
    const matchingTrainers = await Trainer.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ],
    }).select('_id').lean();
    filter.trainer = { $in: matchingTrainers.map((trainer) => trainer._id) };
  }

  const records = await TrainerDailyAttendance.find(filter)
    .populate({ path: 'trainer', select: 'name employeeId' })
    .sort({ punchInAt: -1 })
    .lean();

  const late = records.filter((record) => isLatePunch(record.punchInAt) && isLateMisconductDate(record.date));
  const reviews = await LatePunchReview.find({
    attendance: { $in: late.map((record) => record._id) },
  }).lean();
  const reviewByAttendance = new Map(reviews.map((review) => [String(review.attendance), review]));

  const visible = late.filter((record) => {
    const reviewed = reviewByAttendance.has(String(record._id));
    if (status === 'pending') return !reviewed;
    if (status === 'reviewed') return reviewed;
    return true;
  });

  const trainerIds = [...new Set(visible.map((record) => String(record.trainer?._id || record.trainer)))];
  const marked = await LatePunchReview.find({
    trainer: { $in: trainerIds },
    monthKey,
    dateKey: { $gte: LATE_MISCONDUCT_START },
    decision: { $in: ['warning', 'misconduct'] },
  }).select('trainer').lean();
  const marksByTrainer = new Map();
  marked.forEach((review) => {
    const key = String(review.trainer);
    marksByTrainer.set(key, (marksByTrainer.get(key) || 0) + 1);
  });

  const total = visible.length;
  const pageItems = visible.slice((page - 1) * limit, page * limit).map((record) => {
    const trainerId = String(record.trainer?._id || record.trainer);
    const review = reviewByAttendance.get(String(record._id)) || null;
    const priorMarksThisMonth = marksByTrainer.get(trainerId) || 0;
    const distance = punchDistanceFromCampus(record.photoPunch);
    return {
      _id: record._id,
      trainer: record.trainer,
      date: toAttendanceDateKey(record.date),
      punchInAt: record.punchInAt,
      punchInSource: record.punchInSource,
      oifNumber: record.oifNumber || '',
      hasPhoto: Boolean(record.photoPunch?.driveFileId || record.punchInImageUrl),
      photoMode: record.photoPunch?.driveFileId ? 'drive' : (record.punchInImageUrl ? 'url' : 'none'),
      photoUrl: record.photoPunch?.driveFileId ? '' : (record.punchInImageUrl || ''),
      distance,
      review: review
        ? {
          decision: review.decision,
          reviewedAt: review.createdAt,
          complianceAdded: Boolean(review.compliance),
        }
        : null,
      priorMarksThisMonth,
      nextMarkOutcome: lateMarkOutcome(priorMarksThisMonth),
    };
  });

  res.json({
    month: monthKey,
    items: pageItems,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
};

export const reviewLatePunch = async (req, res) => {
  const action = req.body?.action === 'dismiss' ? 'dismiss' : 'mark';
  const record = await TrainerDailyAttendance.findById(req.params.id);
  if (!record || !LATE_PUNCH_SOURCES.includes(record.punchInSource) || !isLatePunch(record.punchInAt) || !isLateMisconductDate(record.date)) {
    return res.status(404).json({ message: 'Late punch not found' });
  }

  const existing = await LatePunchReview.findOne({ attendance: record._id }).select('_id');
  if (existing) {
    return res.status(409).json({ message: 'This punch has already been reviewed' });
  }

  const dateKey = toAttendanceDateKey(record.date);
  const monthKey = dateKey.slice(0, 7);
  let decision = 'dismissed';
  let compliance = null;

  if (action === 'mark') {
    const priorMarks = await LatePunchReview.countDocuments({
      trainer: record.trainer,
      monthKey,
      dateKey: { $gte: LATE_MISCONDUCT_START },
      decision: { $in: ['warning', 'misconduct'] },
    });
    decision = lateMarkOutcome(priorMarks);
    if (decision === 'misconduct') {
      const sourceLabel = record.punchInSource === 'toms_camera' ? 'TOMS' : 'WhatsApp';
      compliance = await TrainerCompliance.create({
        trainer: record.trainer,
        date: record.date,
        dateKey,
        monthKey,
        remark: `Late misconduct: punched after 8:40 on ${dateKey} via ${sourceLabel}.`,
        createdBy: req.user._id,
      });
    }
  }

  try {
    await LatePunchReview.create({
      attendance: record._id,
      trainer: record.trainer,
      dateKey,
      monthKey,
      decision,
      compliance: compliance?._id,
      reviewedBy: req.user._id,
    });
  } catch (error) {
    if (compliance) await compliance.deleteOne();
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'This punch has already been reviewed' });
    }
    throw error;
  }

  if (decision === 'warning' || decision === 'misconduct') {
    try {
      await notifyTrainerOfLateMark({
        trainerId: record.trainer,
        decision,
        dateKey,
        actor: req.user,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[late-punch] trainer notification failed', error?.message);
      }
    }
  }

  const message = decision === 'warning'
    ? 'Recorded as a warning. The first late mark this month does not add a compliance point.'
    : decision === 'misconduct'
      ? 'Late misconduct recorded. 1 compliance point was added for this trainer.'
      : 'Punch left as on time. No warning or compliance was added.';

  res.json({
    decision,
    complianceAdded: Boolean(compliance),
    monthKey,
    message,
  });
};

export const getLatePunchPhoto = async (req, res) => {
  const record = await TrainerDailyAttendance.findById(req.params.id)
    .select('punchInAt punchInSource photoPunch punchInImageUrl')
    .lean();
  if (!record || !LATE_PUNCH_SOURCES.includes(record.punchInSource) || !isLatePunch(record.punchInAt) || !isLateMisconductDate(record.date)) {
    return res.status(404).json({ message: 'Late punch photo not found' });
  }

  if (record.photoPunch?.driveFileId) {
    try {
      const buffer = await downloadPunchPhoto(record.photoPunch.driveFileId);
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'private, max-age=300');
      return res.send(buffer);
    } catch {
      return res.status(404).json({ message: 'Punch photo is not available' });
    }
  }

  if (record.punchInImageUrl && /^https:\/\//i.test(record.punchInImageUrl)) {
    return res.redirect(record.punchInImageUrl);
  }

  return res.status(404).json({ message: 'Punch photo is not available' });
};
