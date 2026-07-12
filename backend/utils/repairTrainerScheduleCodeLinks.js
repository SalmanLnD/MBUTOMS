import Trainer from '../models/Trainer.js';
import Schedule from '../models/Schedule.js';
import {
  IDSA_TRAINER_NAMES,
  PSTP_TRAINER_NAMES,
  isPlaceholderLegacyName,
  trainerNameMatchesLegacy,
} from './trainerMappings.js';

const LEGACY_SCHEDULE_MAPS = [IDSA_TRAINER_NAMES, PSTP_TRAINER_NAMES];

const scoreLegacyNameMatch = (trainerName, legacyName) => {
  const trainer = String(trainerName || '').trim().toLowerCase();
  const legacy = String(legacyName || '').trim().toLowerCase();
  if (!trainer || !legacy) return 0;
  if (trainer === legacy) return 100;
  if (!trainerNameMatchesLegacy(trainerName, legacyName)) return 0;

  const legacyWordCount = legacy.split(/\s+/).filter(Boolean).length;
  const trainerWordCount = trainer.split(/\s+/).filter(Boolean).length;
  if (legacyWordCount === trainerWordCount) return 90;
  if (legacyWordCount > 1) return 85;
  return 70;
};

export const repairTrainerScheduleCodeLinks = async () => {
  const assignments = new Map();

  for (const legacyMap of LEGACY_SCHEDULE_MAPS) {
    for (const [scheduleCode, legacyName] of Object.entries(legacyMap)) {
      const scheduleCount = await Schedule.countDocuments({ trainerCode: scheduleCode });
      if (!scheduleCount) continue;

      const byEmployeeId = await Trainer.findOne({ employeeId: scheduleCode });
      if (byEmployeeId) {
        assignments.set(scheduleCode, byEmployeeId._id.toString());
        continue;
      }

      if (isPlaceholderLegacyName(scheduleCode, legacyName)) continue;

      const trainers = await Trainer.find();
      const bestMatch = trainers
        .map((trainer) => ({
          trainer,
          score: scoreLegacyNameMatch(trainer.name, legacyName),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)[0];

      if (bestMatch) {
        assignments.set(scheduleCode, bestMatch.trainer._id.toString());
      }
    }
  }

  const trainerToCodes = new Map();
  for (const [scheduleCode, trainerId] of assignments) {
    if (!trainerToCodes.has(trainerId)) trainerToCodes.set(trainerId, []);
    trainerToCodes.get(trainerId).push(scheduleCode);
  }

  let updated = 0;
  await Trainer.updateMany({}, { $set: { scheduleTrainerCodes: [] } });

  for (const [trainerId, codes] of trainerToCodes) {
    const result = await Trainer.updateOne(
      { _id: trainerId },
      { $set: { scheduleTrainerCodes: [...new Set(codes)] } }
    );
    if (result.modifiedCount) updated += 1;
  }

  return { updated, linkedCodes: assignments.size };
};
