import Trainer from '../models/Trainer.js';
import TrainerObservation from '../models/TrainerObservation.js';
import FeedbackResponse from '../models/FeedbackResponse.js';
import TrainerCompliance from '../models/TrainerCompliance.js';
import { mergeRosterFilter } from '../utils/rosterFilter.js';
import {
  getReplacementRequiredDaysByTrainer,
  resolvePlpMonthKey,
} from '../utils/replacementRequiredDays.js';
import {
  PLP_WEIGHTAGES,
  attendanceScoreFromRrd,
  complianceScoreFromCount,
  computePlpFinalRating,
  plpWeightageLabels,
  roundPlpScore,
} from '../utils/plpScoring.js';
import { getAttendanceExportMonthKeys } from '../utils/trainerAttendanceExport.js';

const buildPlpRowsForMonth = async (monthKey) => {
  const rosterFilter = await mergeRosterFilter({ status: 'active' }, { rosterOnly: true });
  const trainers = await Trainer.find(rosterFilter)
    .select('name employeeId scheduleTrainerCodes')
    .sort({ employeeId: 1 })
    .lean();

  const trainerIds = trainers.map((trainer) => trainer._id);

  const [feedbackAvgs, observations, complianceCounts, rrdByTrainer] = await Promise.all([
    trainerIds.length
      ? FeedbackResponse.aggregate([
        {
          $match: {
            monthKey,
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
        monthKey,
        trainer: { $in: trainerIds },
        type: { $in: ['class', 'demo'] },
      })
        .select('trainer type rating')
        .lean()
      : [],
    trainerIds.length
      ? TrainerCompliance.aggregate([
        { $match: { monthKey, trainer: { $in: trainerIds } } },
        { $group: { _id: '$trainer', count: { $sum: 1 } } },
      ])
      : [],
    getReplacementRequiredDaysByTrainer({ monthKey, trainers }),
  ]);

  const feedbackMap = new Map(
    feedbackAvgs.map((row) => [row._id.toString(), roundPlpScore(row.average)])
  );
  const classMap = new Map();
  const demoMap = new Map();
  observations.forEach((row) => {
    const id = row.trainer.toString();
    if (row.type === 'class') classMap.set(id, row.rating ?? null);
    if (row.type === 'demo') demoMap.set(id, row.rating ?? null);
  });
  const complianceMap = new Map(
    complianceCounts.map((row) => [row._id.toString(), row.count])
  );

  return trainers.map((trainer) => {
    const id = trainer._id.toString();
    const rrdDays = rrdByTrainer.get(id) || 0;
    const complianceCount = complianceMap.get(id) || 0;
    const scores = {
      feedback: feedbackMap.get(id) ?? null,
      classObservation: classMap.has(id) ? classMap.get(id) : null,
      demoObservation: demoMap.has(id) ? demoMap.get(id) : null,
      attendance: attendanceScoreFromRrd(rrdDays),
      compliance: complianceScoreFromCount(complianceCount),
    };

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
      finalPlpRating: computePlpFinalRating(scores),
    };
  });
};

export const getPlpSheet = async (req, res) => {
  const monthKey = resolvePlpMonthKey(req.query.month);
  const rows = await buildPlpRowsForMonth(monthKey);

  res.json({
    monthKey,
    weightages: PLP_WEIGHTAGES,
    headers: plpWeightageLabels(),
    rows,
  });
};

export const buildPlpExportPayload = async () => {
  const monthKeys = getAttendanceExportMonthKeys();
  const header = [
    'Month',
    'Employee ID',
    'Trainer',
    `Feedback (${PLP_WEIGHTAGES.feedback}%)`,
    `Class observation (${PLP_WEIGHTAGES.classObservation}%)`,
    `Demo observation (${PLP_WEIGHTAGES.demoObservation}%)`,
    `Attendance (${PLP_WEIGHTAGES.attendance}%)`,
    'RRD days',
    `Compliance (${PLP_WEIGHTAGES.compliance}%)`,
    'Compliance count',
    'Final PLP rating',
  ];

  const rows = [header];
  for (const monthKey of monthKeys) {
    const monthRows = await buildPlpRowsForMonth(monthKey);
    monthRows.forEach((row) => {
      rows.push([
        monthKey,
        row.employeeId || '',
        row.name || '',
        row.feedbackRating ?? '',
        row.classObservationRating ?? '',
        row.demoObservationRating ?? '',
        row.attendanceScore ?? '',
        row.replacementRequiredDays ?? 0,
        row.complianceScore ?? '',
        row.complianceCount ?? 0,
        row.finalPlpRating ?? '',
      ]);
    });
  }

  return {
    exportedAt: new Date().toISOString(),
    monthKeys,
    rows,
  };
};

export { buildPlpRowsForMonth };
