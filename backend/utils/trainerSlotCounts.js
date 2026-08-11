import Schedule from '../models/Schedule.js';
import Trainer from '../models/Trainer.js';

/** Direct ownership codes only — excludes fuzzy legacy name mappings. */
export const getOwnedScheduleCodes = (trainer) => {
  const codes = new Set();
  if (trainer?.employeeId) codes.add(String(trainer.employeeId).trim());
  (trainer.scheduleTrainerCodes || []).forEach((code) => {
    if (code) codes.add(String(code).trim());
  });
  return [...codes].filter(Boolean);
};

export const trainerIdsWithOwnedSlots = async (trainers) => {
  if (!trainers.length) return new Set();

  const codeToTrainerIds = new Map();
  trainers.forEach((trainer) => {
    getOwnedScheduleCodes(trainer).forEach((code) => {
      if (!codeToTrainerIds.has(code)) codeToTrainerIds.set(code, new Set());
      codeToTrainerIds.get(code).add(trainer._id.toString());
    });
  });

  const allCodes = [...codeToTrainerIds.keys()];
  if (!allCodes.length) return new Set();

  const schedules = await Schedule.find({ trainerCode: { $in: allCodes } })
    .select('trainerCode')
    .lean();

  const busyTrainerIds = new Set();
  schedules.forEach((schedule) => {
    const owners = codeToTrainerIds.get(schedule.trainerCode);
    owners?.forEach((id) => busyTrainerIds.add(id));
  });

  return busyTrainerIds;
};

export const trainerHasOwnedSlots = async (trainer) => {
  const codes = getOwnedScheduleCodes(trainer);
  if (!codes.length) return false;
  return Boolean(await Schedule.exists({ trainerCode: { $in: codes } }));
};

export const listReplacementCandidates = async ({
  excludeId,
  slotFreeOnly = true,
}) => {
  const trainers = await Trainer.find({
    _id: { $ne: excludeId },
    employmentStatus: { $ne: 'resigned' },
  })
    .select('name employeeId scheduleTrainerCodes employmentStatus status')
    .sort({ name: 1 })
    .lean();

  if (!slotFreeOnly) {
    return trainers;
  }

  const busyTrainerIds = await trainerIdsWithOwnedSlots(trainers);
  return trainers.filter((trainer) => !busyTrainerIds.has(trainer._id.toString()));
};
