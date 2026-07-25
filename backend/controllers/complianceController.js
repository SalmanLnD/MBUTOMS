import Trainer from '../models/Trainer.js';
import TrainerCompliance from '../models/TrainerCompliance.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';
import { toAttendanceDateKey, normalizeAttendanceDate } from '../utils/attendanceTracking.js';
import { complianceScoreFromCount } from '../utils/plpScoring.js';

const populateOptions = [
  { path: 'trainer', select: 'name employeeId' },
  { path: 'createdBy', select: 'name email role' },
];

export const listCompliance = async (req, res) => {
  const monthKey = String(req.query.month || '').trim();
  const search = String(req.query.search || req.query.trainer || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (/^\d{4}-\d{2}$/.test(monthKey)) {
    filter.monthKey = monthKey;
  }

  if (search) {
    const rosterFilter = await mergeRosterFilter({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ],
    }, { rosterOnly: true });
    const trainers = await Trainer.find(rosterFilter).select('_id').lean();
    filter.trainer = { $in: trainers.map((trainer) => trainer._id) };
  }

  const [items, total] = await Promise.all([
    TrainerCompliance.find(filter)
      .populate(populateOptions)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TrainerCompliance.countDocuments(filter),
  ]);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
};

export const createCompliance = async (req, res) => {
  const trainerId = req.body.trainerId || req.body.trainer;
  const remark = String(req.body.remark || '').trim();
  const dateInput = req.body.date;

  if (!trainerId) {
    return res.status(400).json({ message: 'Trainer is required' });
  }
  if (!dateInput) {
    return res.status(400).json({ message: 'Date is required' });
  }
  if (!remark) {
    return res.status(400).json({ message: 'Remark is required' });
  }

  const trainer = await Trainer.findById(trainerId).select('_id name employeeId');
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  const date = normalizeAttendanceDate(dateInput);
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({ message: 'Valid date is required' });
  }

  const dateKey = toAttendanceDateKey(date);
  const monthKey = dateKey.slice(0, 7);

  const created = await TrainerCompliance.create({
    trainer: trainer._id,
    date,
    dateKey,
    monthKey,
    remark,
    createdBy: req.user._id,
  });

  const complianceCount = await TrainerCompliance.countDocuments({
    trainer: trainer._id,
    monthKey,
  });

  const populated = await TrainerCompliance.findById(created._id)
    .populate(populateOptions)
    .lean();

  res.status(201).json({
    item: populated,
    monthKey,
    complianceCount,
    complianceScore: complianceScoreFromCount(complianceCount),
  });
};

export const deleteCompliance = async (req, res) => {
  const item = await TrainerCompliance.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Compliance record not found' });
  }

  const { trainer, monthKey } = item;
  await item.deleteOne();

  const complianceCount = await TrainerCompliance.countDocuments({ trainer, monthKey });

  res.json({
    deleted: true,
    monthKey,
    trainerId: trainer,
    complianceCount,
    complianceScore: complianceScoreFromCount(complianceCount),
  });
};

export const getComplianceTrainerOptions = async (req, res) => {
  const rosterFilter = await mergeRosterFilter({ status: 'active' }, { rosterOnly: true });
  const trainers = await Trainer.find(rosterFilter)
    .select('name employeeId')
    .sort({ name: 1 })
    .lean();
  res.json({ trainers });
};
