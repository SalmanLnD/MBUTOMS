import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import { ROLES } from './roles.js';

export const isSubjectCoordinator = (user) => user?.role === ROLES.SUBJECT_COORDINATOR;

export const getCoordinatorSubjectIds = (user) => {
  if (!isSubjectCoordinator(user)) return [];

  return (user.coordinatorSubjects || []).map((entry) => {
    if (!entry) return '';
    if (typeof entry === 'object' && entry._id) return entry._id.toString();
    return entry.toString();
  }).filter(Boolean);
};

export const buildTrainerFilterForCoordinatorSubjects = async (subjectIds) => {
  if (!subjectIds.length) {
    return { _id: { $in: [] } };
  }

  const subjects = await Subject.find({ _id: { $in: subjectIds } }).select('trainerEligible');
  const trainerIds = new Set();

  subjects.forEach((subject) => {
    (subject.trainerEligible || []).forEach((trainerId) => {
      trainerIds.add(trainerId.toString());
    });
  });

  const assignedTrainers = await Trainer.find({ subjects: { $in: subjectIds } }).select('_id');
  assignedTrainers.forEach((trainer) => {
    trainerIds.add(trainer._id.toString());
  });

  if (!trainerIds.size) {
    return { _id: { $in: [] } };
  }

  return { _id: { $in: [...trainerIds] } };
};

export const coordinatorCanAccessSubject = (user, subjectId) => {
  const subjectIds = getCoordinatorSubjectIds(user);
  if (!subjectIds.length) return false;
  return subjectIds.includes(subjectId?.toString());
};

export const coordinatorCanAccessTrainer = async (user, trainerId) => {
  const subjectIds = getCoordinatorSubjectIds(user);
  if (!subjectIds.length) return false;

  const filter = await buildTrainerFilterForCoordinatorSubjects(subjectIds);
  const allowedIds = filter._id?.$in || [];
  return allowedIds.some((id) => id.toString() === trainerId?.toString());
};
