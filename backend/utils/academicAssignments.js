import Subject from '../models/Subject.js';
import AcademicUserAssignment from '../models/AcademicUserAssignment.js';
import { academicTermsEnabled, getAcademicTermContext } from './academicTermContext.js';

export const usesTermAssignments = () => academicTermsEnabled() && !getAcademicTermContext()?.maintenance;

export const getTrainerAcademicSubjects = async (trainer, select = 'name code hours slotCount slotTimings') => {
  if (!usesTermAssignments()) return trainer?.subjects || [];
  if (!trainer?._id) return [];
  return Subject.find({ trainerEligible: trainer._id }).select(select).lean();
};

export const projectTrainerAcademicSubjects = async (trainer, select) => {
  if (!trainer || !usesTermAssignments()) return trainer;
  const value = trainer.toObject ? trainer.toObject() : { ...trainer };
  value.subjects = await getTrainerAcademicSubjects(trainer, select);
  return value;
};

export const projectTrainerAcademicList = async (trainers) => {
  if (!usesTermAssignments() || !trainers.length) return trainers;
  const subjects = await Subject.find({ trainerEligible: { $in: trainers.map((trainer) => trainer._id) } })
    .select('name code hours slotCount slotTimings trainerEligible').lean();
  return trainers.map((trainer) => {
    const value = trainer.toObject ? trainer.toObject() : { ...trainer };
    value.subjects = subjects.filter((subject) => subject.trainerEligible.some((id) => String(id) === String(trainer._id)))
      .map(({ trainerEligible: _eligible, ...subject }) => subject);
    return value;
  });
};

// Never save this hydrated document: authentication identity remains shared,
// while these two permission lists belong to the resolved semester only.
export const hydrateAcademicUser = async (user) => {
  if (!user || !usesTermAssignments()) return user;
  const assignment = await AcademicUserAssignment.findOne({ user: user._id }).lean();
  user.coordinatorSubjects = assignment?.coordinatorSubjects || [];
  user.evaluatorSubjects = assignment?.evaluatorSubjects || [];
  return user;
};

export const setAcademicUserSubjects = async (user, field, subjectIds) => {
  if (!['coordinatorSubjects', 'evaluatorSubjects'].includes(field)) throw new Error('Invalid academic assignment field');
  if (!usesTermAssignments()) {
    user[field] = subjectIds;
    return;
  }
  const found = await Subject.countDocuments({ _id: { $in: subjectIds } });
  if (found !== new Set(subjectIds.map(String)).size) {
    throw Object.assign(new Error('Subject assignment must belong to this semester.'), { statusCode: 400 });
  }
  await AcademicUserAssignment.updateOne({ user: user._id }, { $set: { [field]: subjectIds } }, { upsert: true });
};
