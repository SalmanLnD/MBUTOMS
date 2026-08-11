import Trainer from '../models/Trainer.js';
import { transferTrainerRole } from '../utils/trainerPermanentTransfer.js';
import { normalizeAttendanceDate } from '../utils/attendanceDates.js';
import {
  listReplacementCandidates,
  trainerHasOwnedSlots,
} from '../utils/trainerSlotCounts.js';

const loadTrainerPair = async (sourceId, successorId) => {
  const [sourceTrainer, successorTrainer] = await Promise.all([
    Trainer.findById(sourceId).populate('subjects'),
    Trainer.findById(successorId).populate('subjects'),
  ]);

  if (!sourceTrainer) {
    throw Object.assign(new Error('Trainer not found'), { statusCode: 404 });
  }
  if (!successorTrainer) {
    throw Object.assign(new Error('Successor trainer not found'), { statusCode: 404 });
  }
  if (sourceTrainer.employmentStatus === 'resigned') {
    throw Object.assign(new Error('This trainer has already resigned'), { statusCode: 409 });
  }
  if (await trainerHasOwnedSlots(successorTrainer)) {
    throw Object.assign(
      new Error('Replacement trainer must not have any timetable slots assigned'),
      { statusCode: 400 }
    );
  }

  return { sourceTrainer, successorTrainer };
};

export const getReplacementCandidates = async (req, res) => {
  const excludeId = req.query.excludeId;
  if (!excludeId) {
    return res.status(400).json({ message: 'excludeId is required' });
  }

  const slotFreeOnly = req.query.slotFree !== 'false';
  const trainers = await listReplacementCandidates({ excludeId, slotFreeOnly });

  res.json({
    trainers: trainers.map((trainer) => ({
      _id: trainer._id,
      name: trainer.name,
      employeeId: trainer.employeeId,
      label: `${trainer.name} (${trainer.employeeId})`,
    })),
  });
};

export const resignTrainer = async (req, res) => {
  const { successorTrainerId, resignationDate } = req.body;
  if (!successorTrainerId) {
    return res.status(400).json({ message: 'A permanent replacement trainer is required' });
  }
  if (!resignationDate) {
    return res.status(400).json({ message: 'Resignation date is required' });
  }

  const { sourceTrainer, successorTrainer } = await loadTrainerPair(
    req.params.id,
    successorTrainerId
  );

  const result = await transferTrainerRole({
    sourceTrainer,
    successorTrainer,
    mode: 'resignation',
    resignationDate: normalizeAttendanceDate(resignationDate),
  });

  const updatedSource = await Trainer.findById(sourceTrainer._id)
    .populate('successorTrainer', 'name employeeId')
    .lean();
  const updatedSuccessor = await Trainer.findById(successorTrainer._id)
    .select('name employeeId')
    .lean();

  res.json({
    message: `${sourceTrainer.name} marked as resigned. All schedules and CAMU credentials transferred to ${successorTrainer.name}.`,
    transfer: result,
    trainer: updatedSource,
    successor: updatedSuccessor,
  });
};

export const permanentReplaceTrainer = async (req, res) => {
  const { successorTrainerId, effectiveDate } = req.body;
  if (!successorTrainerId) {
    return res.status(400).json({ message: 'Replacement trainer is required' });
  }
  if (!effectiveDate) {
    return res.status(400).json({ message: 'Effective from date is required' });
  }

  const { sourceTrainer, successorTrainer } = await loadTrainerPair(
    req.params.id,
    successorTrainerId
  );

  const result = await transferTrainerRole({
    sourceTrainer,
    successorTrainer,
    mode: 'replacement',
    effectiveDate: normalizeAttendanceDate(effectiveDate),
  });

  const updatedSource = await Trainer.findById(sourceTrainer._id)
    .populate('successorTrainer', 'name employeeId')
    .lean();
  const updatedSuccessor = await Trainer.findById(successorTrainer._id)
    .select('name employeeId')
    .lean();

  res.json({
    message: `Role transferred from ${sourceTrainer.name} to ${successorTrainer.name} effective ${effectiveDate}. ${sourceTrainer.name} remains active with no timetable slots.`,
    transfer: result,
    trainer: updatedSource,
    successor: updatedSuccessor,
  });
};
