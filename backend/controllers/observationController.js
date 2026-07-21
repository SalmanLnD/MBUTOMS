import Trainer from '../models/Trainer.js';
import TrainerObservation, { OBSERVATION_TYPES } from '../models/TrainerObservation.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

const isValidMonthKey = (value) => MONTH_KEY_PATTERN.test(String(value || '').trim());

const normalizeType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  return OBSERVATION_TYPES.includes(type) ? type : null;
};

export const getObservations = async (req, res) => {
  const monthKey = String(req.query.month || '').trim();
  const type = normalizeType(req.query.type);

  if (!isValidMonthKey(monthKey)) {
    return res.status(400).json({ message: 'Valid month (YYYY-MM) is required' });
  }
  if (!type) {
    return res.status(400).json({ message: 'type must be demo or class' });
  }

  const rosterFilter = await mergeRosterFilter({ status: 'active' }, { rosterOnly: true });
  const [trainers, observations] = await Promise.all([
    Trainer.find(rosterFilter)
      .select('name employeeId')
      .sort({ employeeId: 1 })
      .lean(),
    TrainerObservation.find({ monthKey, type })
      .select('trainer rating comments updatedAt ratedBy')
      .lean(),
  ]);

  const byTrainer = new Map(
    observations.map((row) => [row.trainer.toString(), row])
  );

  res.json({
    monthKey,
    type,
    trainers: trainers.map((trainer) => {
      const observation = byTrainer.get(trainer._id.toString());
      return {
        trainerId: trainer._id,
        employeeId: trainer.employeeId,
        name: trainer.name,
        rating: observation?.rating ?? null,
        comments: observation?.comments || '',
        updatedAt: observation?.updatedAt || null,
      };
    }),
  });
};

export const upsertObservation = async (req, res) => {
  const trainerId = req.params.trainerId;
  const monthKey = String(req.body.monthKey || '').trim();
  const type = normalizeType(req.body.type);
  const comments = String(req.body.comments || '').trim();

  if (!isValidMonthKey(monthKey)) {
    return res.status(400).json({ message: 'Valid monthKey (YYYY-MM) is required' });
  }
  if (!type) {
    return res.status(400).json({ message: 'type must be demo or class' });
  }

  const trainer = await Trainer.findById(trainerId).select('_id name employeeId');
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  let rating = req.body.rating;
  if (rating === '' || rating === undefined || rating === null) {
    rating = null;
  } else {
    rating = Number(rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    rating = Math.round(rating);
  }

  if (rating == null && !comments) {
    await TrainerObservation.deleteOne({ trainer: trainerId, monthKey, type });
    return res.json({
      trainerId: trainer._id,
      employeeId: trainer.employeeId,
      name: trainer.name,
      rating: null,
      comments: '',
      updatedAt: null,
    });
  }

  const observation = await TrainerObservation.findOneAndUpdate(
    { trainer: trainerId, monthKey, type },
    {
      $set: {
        rating,
        comments,
        ratedBy: req.user?._id || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({
    trainerId: trainer._id,
    employeeId: trainer.employeeId,
    name: trainer.name,
    rating: observation.rating,
    comments: observation.comments || '',
    updatedAt: observation.updatedAt,
  });
};
