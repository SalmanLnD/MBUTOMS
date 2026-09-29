import User from '../models/User.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import { ROLES } from './roles.js';
import { SUBJECT_COORDINATOR_ASSIGNMENTS } from './subjectCoordinatorConfig.js';

const sameIdSet = (left = [], right = []) => {
  const a = [...new Set(left.map(String))].sort();
  const b = [...new Set(right.map(String))].sort();
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
};

const groupAssignmentsByEmployee = (assignments) => {
  const grouped = new Map();
  assignments.forEach((assignment) => {
    const current = grouped.get(assignment.employeeId) || [];
    current.push(assignment);
    grouped.set(assignment.employeeId, current);
  });
  return grouped;
};

export const syncSubjectCoordinators = async () => {
  let updated = 0;
  const results = [];

  for (const [employeeId, assignments] of groupAssignmentsByEmployee(SUBJECT_COORDINATOR_ASSIGNMENTS)) {
    const subjectCodes = [...new Set(assignments.map((assignment) => assignment.subjectCode))];
    const subjects = await Subject.find({ code: { $in: subjectCodes } }).select('_id code name');
    const foundCodes = new Set(subjects.map((subject) => subject.code));
    const missingCodes = subjectCodes.filter((code) => !foundCodes.has(code));

    if (!subjects.length) {
      results.push({
        employeeId,
        status: 'skipped',
        reason: `Subject(s) not found: ${missingCodes.join(', ')}`,
      });
      continue;
    }

    const trainer = await Trainer.findOne({ employeeId }).select('_id name employeeId email');

    if (!trainer) {
      results.push({
        employeeId,
        status: 'skipped',
        reason: `Trainer ${employeeId} not found`,
      });
      continue;
    }

    const email = trainer.email?.trim()?.toLowerCase();
    const user = await User.findOne({
      $or: [
        { trainer: trainer._id },
        ...(email ? [{ email }] : []),
      ],
    });

    if (!user) {
      results.push({
        employeeId,
        status: 'skipped',
        reason: 'No user account linked to trainer',
      });
      continue;
    }

    const subjectIds = subjects.map((subject) => subject._id);
    const trainerId = trainer._id.toString();
    const currentSubjectIds = (user.coordinatorSubjects || []).map((id) => id.toString());
    const nextSubjectIds = subjectIds.map((id) => id.toString());
    const needsUpdate =
      user.role !== ROLES.SUBJECT_COORDINATOR
      || user.trainer?.toString() !== trainerId
      || !sameIdSet(currentSubjectIds, nextSubjectIds);

    const subjectCodeList = subjects.map((subject) => subject.code);

    if (!needsUpdate) {
      results.push({
        employeeId,
        trainerName: trainer.name,
        subjectCodes: subjectCodeList,
        missingCodes,
        userId: user._id.toString(),
        status: 'unchanged',
      });
      continue;
    }

    user.role = ROLES.SUBJECT_COORDINATOR;
    user.trainer = trainer._id;
    user.coordinatorSubjects = subjectIds;
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await user.save();

    updated += 1;
    results.push({
      employeeId,
      trainerName: trainer.name,
      subjectCodes: subjectCodeList,
      missingCodes,
      userId: user._id.toString(),
      status: 'updated',
    });
  }

  return { updated, results };
};
