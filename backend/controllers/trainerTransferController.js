import Trainer from '../models/Trainer.js';
import { transferTrainerRole } from '../utils/trainerPermanentTransfer.js';
import { normalizeAttendanceDate } from '../utils/attendanceDates.js';
import {
  listReplacementCandidates,
  trainerHasOwnedSlots,
} from '../utils/trainerSlotCounts.js';
import { shouldRequirePermanentReplacement } from '../utils/trainerTransferRules.js';

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
  if (['resigned', 'relocated'].includes(sourceTrainer.employmentStatus)) {
    throw Object.assign(new Error('This trainer has already resigned or relocated'), { statusCode: 409 });
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

const finalizeExitTransfer = async ({
  req,
  res,
  mode,
  resignationDate,
  successorTrainerId,
  messagePrefix,
}) => {
  if (!resignationDate) {
    return res.status(400).json({ message: 'Resignation date is required' });
  }

  const sourceTrainer = await Trainer.findById(req.params.id).populate('subjects');
  if (!sourceTrainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }
  if (sourceTrainer.employmentStatus === 'resigned') {
    return res.status(409).json({ message: 'This trainer has already resigned' });
  }

  const hasAssignedClasses = await trainerHasOwnedSlots(sourceTrainer);
  const requiresPermanentReplacement = shouldRequirePermanentReplacement({
    mode,
    hasAssignedClasses,
  });

  if (requiresPermanentReplacement && !successorTrainerId) {
    return res.status(400).json({
      message: 'A permanent replacement trainer is required because this trainer still has assigned classes.',
    });
  }

  if (!successorTrainerId) {
    const exitDate = normalizeAttendanceDate(resignationDate);
    const finalEmploymentStatus = mode === 'relocate' ? 'relocated' : 'resigned';
    await Trainer.updateOne(
      { _id: sourceTrainer._id },
      {
        $set: {
          employmentStatus: finalEmploymentStatus,
          resignationDate: exitDate,
          includeInAttendanceUntilMonth: exitDate
            ? `${exitDate.getUTCFullYear()}-${String(exitDate.getUTCMonth() + 1).padStart(2, '0')}`
            : '',
          status: 'unavailable',
          showInRoster: false,
          successorTrainer: null,
          roleTransferEffectiveDate: exitDate,
        },
      }
    );

    const updatedSource = await Trainer.findById(sourceTrainer._id)
      .populate('successorTrainer', 'name employeeId')
      .lean();

    return res.json({
      message: `${sourceTrainer.name} marked as ${mode === 'relocate' ? 'relocated' : 'resigned'} without a permanent replacement because no timetable classes remain.`,
      transfer: { mode, schedulesTransferred: 0, subjectsTransferred: 0 },
      trainer: updatedSource,
      successor: null,
    });
  }

  const { successorTrainer } = await loadTrainerPair(req.params.id, successorTrainerId);

  const result = await transferTrainerRole({
    sourceTrainer,
    successorTrainer,
    mode: mode === 'relocate' ? 'relocation' : 'resignation',
    resignationDate: normalizeAttendanceDate(resignationDate),
  });

  const updatedSource = await Trainer.findById(sourceTrainer._id)
    .populate('successorTrainer', 'name employeeId')
    .lean();
  const updatedSuccessor = await Trainer.findById(successorTrainer._id)
    .select('name employeeId')
    .lean();

  res.json({
    message: `${messagePrefix}${successorTrainer.name}.`,
    transfer: result,
    trainer: updatedSource,
    successor: updatedSuccessor,
  });
};

export const resignTrainer = async (req, res) => {
  const { successorTrainerId, resignationDate } = req.body;
  await finalizeExitTransfer({
    req,
    res,
    mode: 'resign',
    resignationDate,
    successorTrainerId,
    messagePrefix: `${req.body?.trainerName || 'Trainer'} marked as resigned. All schedules and CAMU credentials transferred to `,
  });
};

export const relocateTrainer = async (req, res) => {
  const { successorTrainerId, resignationDate } = req.body;
  await finalizeExitTransfer({
    req,
    res,
    mode: 'relocate',
    resignationDate,
    successorTrainerId,
    messagePrefix: `${req.body?.trainerName || 'Trainer'} marked as relocated. All schedules and CAMU credentials transferred to `,
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
