import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { ROLES, FULL_ACCESS_ROLES } from './roles.js';
import { EVALUATOR_ASSIGNMENTS } from './evaluatorConfig.js';
import { buildTrainerFilterForCoordinatorSubjects } from './subjectCoordinatorAccess.js';

export const isEvaluatorRole = (user) => user?.role === ROLES.EVALUATOR;

export const getEvaluatorSubjectIds = (user) =>
  (user?.evaluatorSubjects || [])
    .map((entry) => {
      if (!entry) return '';
      if (typeof entry === 'object' && entry._id) return entry._id.toString();
      return entry.toString();
    })
    .filter(Boolean);

export const hasEvaluatorObservationAccess = (user) =>
  isEvaluatorRole(user) || getEvaluatorSubjectIds(user).length > 0;

export const hasFullObservationAccess = (user) =>
  FULL_ACCESS_ROLES.includes(user?.role);

/** Peer evaluators on overlapping subjects (and self) — admin rates these, not each other. */
export const getEvaluatorPeerTrainerIds = async (subjectIds = []) => {
  if (!subjectIds.length) return [];

  const subjects = await Subject.find({ _id: { $in: subjectIds } }).select('code').lean();
  const codes = new Set(subjects.map((subject) => subject.code));
  const peerEmployeeIds = EVALUATOR_ASSIGNMENTS
    .filter((assignment) => assignment.subjectCodes.some((code) => codes.has(code)))
    .map((assignment) => assignment.employeeId);

  if (!peerEmployeeIds.length) return [];

  const peers = await Trainer.find({ employeeId: { $in: peerEmployeeIds } })
    .select('_id')
    .lean();
  return peers.map((trainer) => trainer._id.toString());
};

/**
 * Trainers an evaluator may rate: allocated subjects, excluding self and peer evaluators.
 */
export const buildTrainerFilterForEvaluator = async (user) => {
  const subjectIds = getEvaluatorSubjectIds(user);
  if (!subjectIds.length) {
    return { _id: { $in: [] } };
  }

  const baseFilter = await buildTrainerFilterForCoordinatorSubjects(subjectIds);
  const allowedIds = new Set((baseFilter._id?.$in || []).map((id) => id.toString()));
  const excludeIds = new Set(await getEvaluatorPeerTrainerIds(subjectIds));

  const selfTrainerId = user?.trainer?._id?.toString?.() || user?.trainer?.toString?.();
  if (selfTrainerId) excludeIds.add(selfTrainerId);

  const filtered = [...allowedIds].filter((id) => !excludeIds.has(id));
  return { _id: { $in: filtered } };
};

export const evaluatorCanRateTrainer = async (user, trainerId) => {
  if (!hasEvaluatorObservationAccess(user)) return false;
  const filter = await buildTrainerFilterForEvaluator(user);
  const allowedIds = filter._id?.$in || [];
  return allowedIds.some((id) => id.toString() === trainerId?.toString());
};

export const getEvaluatorSubjectCodes = async (user) => {
  const subjectIds = getEvaluatorSubjectIds(user);
  if (!subjectIds.length) return [];
  const subjects = await Subject.find({ _id: { $in: subjectIds } }).select('code').lean();
  return subjects.map((subject) => subject.code).filter(Boolean);
};
