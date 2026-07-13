import User from '../models/User.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import { ROLES } from './roles.js';
import { SUBJECT_COORDINATOR_ASSIGNMENTS } from './subjectCoordinatorConfig.js';

export const syncSubjectCoordinators = async () => {
  let updated = 0;
  const results = [];

  for (const assignment of SUBJECT_COORDINATOR_ASSIGNMENTS) {
    const subject = await Subject.findOne({ code: assignment.subjectCode }).select('_id code name');
    const trainer = await Trainer.findOne({ employeeId: assignment.employeeId }).select('_id name employeeId');

    if (!subject) {
      results.push({
        employeeId: assignment.employeeId,
        status: 'skipped',
        reason: `Subject ${assignment.subjectCode} not found`,
      });
      continue;
    }

    if (!trainer) {
      results.push({
        employeeId: assignment.employeeId,
        status: 'skipped',
        reason: `Trainer ${assignment.employeeId} not found`,
      });
      continue;
    }

    const user = await User.findOne({
      $or: [{ trainer: trainer._id }, { email: trainer.email?.trim()?.toLowerCase() }],
    });

    if (!user) {
      results.push({
        employeeId: assignment.employeeId,
        status: 'skipped',
        reason: 'No user account linked to trainer',
      });
      continue;
    }

    const subjectId = subject._id.toString();
    const trainerId = trainer._id.toString();
    const currentSubjectIds = (user.coordinatorSubjects || []).map((id) => id.toString());
    const needsUpdate =
      user.role !== ROLES.SUBJECT_COORDINATOR
      || user.trainer?.toString() !== trainerId
      || currentSubjectIds.length !== 1
      || currentSubjectIds[0] !== subjectId;

    if (!needsUpdate) {
      results.push({
        employeeId: assignment.employeeId,
        trainerName: trainer.name,
        subjectCode: subject.code,
        userId: user._id.toString(),
        status: 'unchanged',
      });
      continue;
    }

    user.role = ROLES.SUBJECT_COORDINATOR;
    user.trainer = trainer._id;
    user.coordinatorSubjects = [subject._id];
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await user.save();

    updated += 1;
    results.push({
      employeeId: assignment.employeeId,
      trainerName: trainer.name,
      subjectCode: subject.code,
      userId: user._id.toString(),
      status: 'updated',
    });
  }

  return { updated, results };
};
