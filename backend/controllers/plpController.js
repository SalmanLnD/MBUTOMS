import Trainer from '../models/Trainer.js';
import TrainerObservation from '../models/TrainerObservation.js';
import FeedbackResponse from '../models/FeedbackResponse.js';
import TrainerCompliance from '../models/TrainerCompliance.js';
import TrainerPlpOverride from '../models/TrainerPlpOverride.js';
import AppSetting from '../models/AppSetting.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';
import { getReplacementRequiredDaysByTrainer } from '../utils/replacementRequiredDays.js';
import {
  buildPlpCycleOptions,
  getPlpCycleRange,
  observationBelongsToCycle,
  resolvePlpCycleKey,
} from '../utils/plpCycles.js';
import {
  PLP_FINAL_MAX,
  PLP_FINAL_MIN,
  PLP_WEIGHTAGES,
  PLP_WEIGHTAGE_KEYS,
  attendanceScoreFromRrd,
  complianceScoreFromCount,
  computeDisplayPlpFinal,
  computePlpFinalRating,
  normalizeWeightages,
  plpWeightageLabels,
  roundPlpScore,
  roundToHalf,
  weightagesTotal,
} from '../utils/plpScoring.js';

const WEIGHTAGES_SETTING_KEY = 'plp_weightages';

export const getStoredPlpWeightages = async () => {
  const setting = await AppSetting.findOne({ key: WEIGHTAGES_SETTING_KEY }).lean();
  if (!setting?.value || typeof setting.value !== 'object') {
    return { ...PLP_WEIGHTAGES };
  }
  return normalizeWeightages(setting.value);
};

export const savePlpWeightages = async (input) => {
  const next = normalizeWeightages(input);
  const total = weightagesTotal(next);
  if (Math.abs(total - 100) > 0.01) {
    const error = new Error(`Weightages must total 100% (currently ${total}%).`);
    error.statusCode = 400;
    throw error;
  }
  await AppSetting.findOneAndUpdate(
    { key: WEIGHTAGES_SETTING_KEY },
    { key: WEIGHTAGES_SETTING_KEY, value: next },
    { upsert: true, new: true }
  );
  return next;
};

const buildPlpRowsForCycle = async (cycleKey, weightages = PLP_WEIGHTAGES) => {
  const cycle = getPlpCycleRange(cycleKey);
  const rosterFilter = await mergeRosterFilter({ status: 'active' }, { rosterOnly: true });
  const trainers = await Trainer.find(rosterFilter)
    .select('name employeeId scheduleTrainerCodes')
    .sort({ employeeId: 1 })
    .lean();

  const trainerIds = trainers.map((trainer) => trainer._id);

  const [feedbackAvgs, observations, complianceCounts, rrdByTrainer, overrides] = await Promise.all([
    trainerIds.length
      ? FeedbackResponse.aggregate([
        {
          $match: {
            monthKey: cycle.feedbackMonthKey,
            trainer: { $in: trainerIds },
            rating: { $gte: 1, $lte: 5 },
          },
        },
        {
          $group: {
            _id: '$trainer',
            average: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ])
      : [],
    trainerIds.length
      ? TrainerObservation.find({
        trainer: { $in: trainerIds },
        type: { $in: ['class', 'demo'] },
        $or: [
          // Dated observations belong to the cycle containing the date,
          // regardless of which month bucket they were saved under.
          { observationDate: { $gte: cycle.startKey, $lte: cycle.endKey } },
          // Undated (legacy) observations fall back to their month bucket.
          { observationDate: { $in: ['', null] }, monthKey: cycle.cycleKey },
        ],
      })
        .select('trainer type rating monthKey observationDate')
        .lean()
      : [],
    trainerIds.length
      ? TrainerCompliance.aggregate([
        {
          $match: {
            trainer: { $in: trainerIds },
            dateKey: { $gte: cycle.startKey, $lte: cycle.endKey },
          },
        },
        { $group: { _id: '$trainer', count: { $sum: 1 } } },
      ])
      : [],
    getReplacementRequiredDaysByTrainer({
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      trainers,
    }),
    trainerIds.length
      ? TrainerPlpOverride.find({
        cycleKey: cycle.cycleKey,
        trainer: { $in: trainerIds },
      })
        .select('trainer finalRating')
        .lean()
      : [],
  ]);

  const feedbackMap = new Map(
    feedbackAvgs.map((row) => [row._id.toString(), roundPlpScore(row.average)])
  );
  // A cycle can span two month buckets, so a trainer may have more than one
  // observation of a type inside it. Average the rated ones; a comments-only
  // (unrated) row never displaces a real rating.
  const ratingsByKey = new Map();
  observations
    .filter((row) => observationBelongsToCycle(row, cycle))
    .forEach((row) => {
      const key = `${row.trainer.toString()}:${row.type}`;
      if (!ratingsByKey.has(key)) ratingsByKey.set(key, []);
      if (row.rating != null) ratingsByKey.get(key).push(Number(row.rating));
    });
  const classMap = new Map();
  const demoMap = new Map();
  ratingsByKey.forEach((ratings, key) => {
    const [id, type] = key.split(':');
    const average = ratings.length
      ? roundPlpScore(ratings.reduce((sum, value) => sum + value, 0) / ratings.length)
      : null;
    (type === 'class' ? classMap : demoMap).set(id, average);
  });
  const complianceMap = new Map(
    complianceCounts.map((row) => [row._id.toString(), row.count])
  );
  const overrideMap = new Map(
    overrides.map((row) => [row.trainer.toString(), row.finalRating])
  );

  return trainers.map((trainer) => {
    const id = trainer._id.toString();
    const rrdDays = rrdByTrainer.get(id) || 0;
    const complianceCount = complianceMap.get(id) || 0;
    const scores = {
      feedback: feedbackMap.get(id) ?? 0,
      classObservation: classMap.has(id) && classMap.get(id) != null ? classMap.get(id) : 0,
      demoObservation: demoMap.has(id) && demoMap.get(id) != null ? demoMap.get(id) : 0,
      attendance: attendanceScoreFromRrd(rrdDays),
      compliance: complianceScoreFromCount(complianceCount),
    };

    const calculatedRaw = computePlpFinalRating(scores, weightages);
    const calculatedFinal = computeDisplayPlpFinal(scores, weightages);
    const manualFinal = overrideMap.has(id) ? overrideMap.get(id) : null;
    const finalPlpRating = manualFinal != null ? manualFinal : calculatedFinal;

    return {
      trainerId: trainer._id,
      employeeId: trainer.employeeId,
      name: trainer.name,
      feedbackRating: scores.feedback,
      classObservationRating: scores.classObservation,
      demoObservationRating: scores.demoObservation,
      attendanceScore: scores.attendance,
      replacementRequiredDays: rrdDays,
      complianceScore: scores.compliance,
      complianceCount,
      calculatedRaw,
      calculatedFinal,
      manualFinal,
      isManualFinal: manualFinal != null,
      finalPlpRating,
    };
  });
};

export const getPlpSheet = async (req, res) => {
  const cycleKey = resolvePlpCycleKey(req.query.cycle || req.query.month);
  const weightages = await getStoredPlpWeightages();
  const cycle = getPlpCycleRange(cycleKey);
  const rows = await buildPlpRowsForCycle(cycleKey, weightages);
  const cycles = buildPlpCycleOptions();

  res.json({
    cycleKey,
    cycle,
    cycles,
    weightages,
    weightageKeys: PLP_WEIGHTAGE_KEYS,
    headers: plpWeightageLabels(weightages),
    rows,
  });
};

export const updatePlpWeightages = async (req, res) => {
  try {
    const weightages = await savePlpWeightages(req.body || {});
    res.json({
      weightages,
      headers: plpWeightageLabels(weightages),
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    throw error;
  }
};

export const upsertPlpFinalRating = async (req, res) => {
  const trainerId = req.params.trainerId;
  const cycleKey = resolvePlpCycleKey(req.body.cycleKey || req.body.cycle || req.body.month);
  const clear = req.body.clear === true || req.body.finalRating === '' || req.body.finalRating == null;

  const trainer = await Trainer.findById(trainerId).select('_id name employeeId');
  if (!trainer) {
    return res.status(404).json({ message: 'Trainer not found' });
  }

  if (clear) {
    await TrainerPlpOverride.deleteOne({ trainer: trainerId, cycleKey });
    const weightages = await getStoredPlpWeightages();
    const rows = await buildPlpRowsForCycle(cycleKey, weightages);
    const row = rows.find((entry) => entry.trainerId.toString() === trainerId.toString());
    return res.json({
      cleared: true,
      cycleKey,
      row,
    });
  }

  // Round to the 0.5 grid. Allow 0 for break / long-leave overrides; otherwise
  // only the normal 3.5–4.5 band (reject out-of-band values instead of clamping).
  const finalRating = roundToHalf(Number(req.body.finalRating));
  const isZeroOverride = finalRating === 0;
  const inNormalBand = finalRating != null
    && finalRating >= PLP_FINAL_MIN
    && finalRating <= PLP_FINAL_MAX;
  if (finalRating == null || (!isZeroOverride && !inNormalBand)) {
    return res.status(400).json({
      message: `Final rating must be 0 (break/long leave) or between ${PLP_FINAL_MIN} and ${PLP_FINAL_MAX} in steps of 0.5`,
    });
  }

  await TrainerPlpOverride.findOneAndUpdate(
    { trainer: trainerId, cycleKey },
    {
      trainer: trainerId,
      cycleKey,
      finalRating,
      updatedBy: req.user._id,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({
    cycleKey,
    trainerId,
    finalRating,
    isManualFinal: true,
  });
};

export const buildPlpExportPayload = async () => {
  const weightages = await getStoredPlpWeightages();
  const cycles = buildPlpCycleOptions();
  const header = [
    'Employee ID',
    'Trainer',
    `Feedback (${weightages.feedback}%)`,
    `Class observation (${weightages.classObservation}%)`,
    `Demo observation (${weightages.demoObservation}%)`,
    `Attendance (${weightages.attendance}%)`,
    'RRD days',
    `Compliance (${weightages.compliance}%)`,
    'Compliance count',
    'Actual final',
    'Rounded final',
    'Manual final',
    'Final PLP rating',
  ];

  const sheets = [];
  for (const option of cycles) {
    const cycleRows = await buildPlpRowsForCycle(option.value, weightages);
    sheets.push({
      cycleKey: option.value,
      sheetName: option.sheetName,
      label: option.label,
      startKey: option.startKey,
      endKey: option.endKey,
      feedbackMonthKey: option.feedbackMonthKey,
      rows: [
        header,
        ...cycleRows.map((row) => [
          row.employeeId || '',
          row.name || '',
          row.feedbackRating ?? '',
          row.classObservationRating ?? '',
          row.demoObservationRating ?? '',
          row.attendanceScore ?? '',
          row.replacementRequiredDays ?? 0,
          row.complianceScore ?? '',
          row.complianceCount ?? 0,
          row.calculatedRaw ?? '',
          row.calculatedFinal ?? '',
          row.manualFinal ?? '',
          row.finalPlpRating ?? '',
        ]),
      ],
    });
  }

  return {
    exportedAt: new Date().toISOString(),
    cycles: cycles.map((cycle) => ({
      value: cycle.value,
      sheetName: cycle.sheetName,
      label: cycle.label,
    })),
    weightages,
    sheets,
  };
};

export { buildPlpRowsForCycle };
