import User from '../models/User.js';
import Trainer from '../models/Trainer.js';
import Subject from '../models/Subject.js';
import { ROLES } from './roles.js';
import { EVALUATOR_ASSIGNMENTS } from './evaluatorConfig.js';

const sameIdSet = (a = [], b = []) => {
  const left = [...new Set(a.map(String))].sort();
  const right = [...new Set(b.map(String))].sort();
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
};

export const syncEvaluators = async () => {
  let updated = 0;
  const results = [];

  for (const assignment of EVALUATOR_ASSIGNMENTS) {
    const subjects = await Subject.find({ code: { $in: assignment.subjectCodes } })
      .select('_id code name')
      .lean();
    const foundCodes = new Set(subjects.map((subject) => subject.code));
    const missingCodes = assignment.subjectCodes.filter((code) => !foundCodes.has(code));

    if (missingCodes.length) {
      results.push({
        employeeId: assignment.employeeId,
        status: 'skipped',
        reason: `Subject(s) not found: ${missingCodes.join(', ')}`,
      });
      continue;
    }

    const trainer = await Trainer.findOne({ employeeId: assignment.employeeId })
      .select('_id name employeeId email')
      .lean();
    if (!trainer) {
      results.push({
        employeeId: assignment.employeeId,
        status: 'skipped',
        reason: `Trainer ${assignment.employeeId} not found`,
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
        employeeId: assignment.employeeId,
        status: 'skipped',
        reason: 'No user account linked to trainer',
      });
      continue;
    }

    const subjectIds = subjects.map((subject) => subject._id);
    const currentSubjectIds = (user.evaluatorSubjects || []).map((id) => id.toString());
    const nextSubjectIds = subjectIds.map((id) => id.toString());
    const trainerLinked = user.trainer?.toString() === trainer._id.toString();
    const shouldPromote = user.role === ROLES.TRAINER;
    const nextRole = shouldPromote ? ROLES.EVALUATOR : user.role;

    const needsUpdate =
      user.role !== nextRole
      || !trainerLinked
      || !sameIdSet(currentSubjectIds, nextSubjectIds);

    if (!needsUpdate) {
      results.push({
        employeeId: assignment.employeeId,
        trainerName: trainer.name,
        subjectCodes: assignment.subjectCodes,
        userId: user._id.toString(),
        role: user.role,
        status: 'unchanged',
      });
      continue;
    }

    user.role = nextRole;
    user.trainer = trainer._id;
    user.evaluatorSubjects = subjectIds;
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await user.save();

    updated += 1;
    results.push({
      employeeId: assignment.employeeId,
      trainerName: trainer.name,
      subjectCodes: assignment.subjectCodes,
      userId: user._id.toString(),
      role: user.role,
      status: 'updated',
    });
  }

  return { updated, results };
};
