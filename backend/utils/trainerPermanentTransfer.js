import Trainer from '../models/Trainer.js';
import Schedule from '../models/Schedule.js';
import { applyTrainerSubjectsChange, toIdStrings } from './syncTrainerSubjectLinks.js';
import { resolveTrainerScheduleCodes } from './trainerMappings.js';
import { resignationMonthKeyFromDate } from './trainerEmployment.js';
import { normalizeAttendanceDate } from './attendanceDates.js';
import { clearAttendanceGridCache } from './attendanceGridCache.js';

const collectSourceScheduleCodes = (trainer) => {
  const codes = new Set(resolveTrainerScheduleCodes(trainer));
  return [...codes].filter(Boolean);
};

const mergeUniqueCodes = (...lists) => [...new Set(lists.flat().filter(Boolean))];

export async function transferTrainerRole({
  sourceTrainer,
  successorTrainer,
  mode,
  resignationDate = null,
  effectiveDate = null,
}) {
  if (!sourceTrainer?._id || !successorTrainer?._id) {
    throw Object.assign(new Error('Source and successor trainers are required'), { statusCode: 400 });
  }
  if (String(sourceTrainer._id) === String(successorTrainer._id)) {
    throw Object.assign(new Error('Successor must be a different trainer'), { statusCode: 400 });
  }
  if (['resigned', 'relocated'].includes(successorTrainer.employmentStatus)) {
    throw Object.assign(new Error('Cannot transfer role to a resigned or relocated trainer'), { statusCode: 400 });
  }

  const sourceCodes = collectSourceScheduleCodes(sourceTrainer);
  const scheduleFilter = sourceCodes.length
    ? { trainerCode: { $in: sourceCodes } }
    : { _id: { $in: [] } };

  const ownedSchedules = await Schedule.find(scheduleFilter).select('_id trainerCode').lean();

  const sourceSubjectIds = toIdStrings(sourceTrainer.subjects || []);
  const successorSubjectIds = toIdStrings(successorTrainer.subjects || []);
  const mergedSubjectIds = [...new Set([...successorSubjectIds, ...sourceSubjectIds])];

  const camuPayload = {};
  if (sourceTrainer.camuErpId?.trim()) {
    camuPayload.camuErpId = sourceTrainer.camuErpId.trim();
  }
  if (sourceTrainer.camuPassword?.trim()) {
    camuPayload.camuPassword = sourceTrainer.camuPassword.trim();
  }

  const legacyCodesForSource = mergeUniqueCodes(
    sourceTrainer.employeeId,
    sourceTrainer.scheduleTrainerCodes || [],
    sourceCodes
  );

  const legacyCodesForSuccessor = legacyCodesForSource.filter(
    (code) => code !== successorTrainer.employeeId
  );

  const normalizedEffective = effectiveDate
    ? normalizeAttendanceDate(effectiveDate)
    : normalizeAttendanceDate(new Date());

  const existingJoinDate = successorTrainer.joiningDate
    ? normalizeAttendanceDate(successorTrainer.joiningDate)
    : null;
  const successorJoiningDate = !existingJoinDate || existingJoinDate > normalizedEffective
    ? normalizedEffective
    : existingJoinDate;

  if (ownedSchedules.length) {
    await Schedule.updateMany(
      { _id: { $in: ownedSchedules.map((schedule) => schedule._id) } },
      { $set: { trainerCode: successorTrainer.employeeId } }
    );
  }

  await Trainer.updateOne(
    { _id: successorTrainer._id },
    {
      $set: {
        ...camuPayload,
        subjects: mergedSubjectIds,
        joiningDate: successorJoiningDate,
      },
      ...(legacyCodesForSuccessor.length
        ? { $addToSet: { scheduleTrainerCodes: { $each: legacyCodesForSuccessor } } }
        : {}),
    }
  );

  await applyTrainerSubjectsChange(
    successorTrainer._id,
    successorSubjectIds,
    mergedSubjectIds
  );

  const sourceSet = {
    subjects: [],
    camuErpId: '',
    camuPassword: '',
    successorTrainer: successorTrainer._id,
    roleTransferEffectiveDate: normalizedEffective,
  };

  if (mode === 'resignation' || mode === 'relocation') {
    const exitDate = normalizeAttendanceDate(resignationDate || new Date());
    Object.assign(sourceSet, {
      employmentStatus: mode === 'relocation' ? 'relocated' : 'resigned',
      resignationDate: exitDate,
      includeInAttendanceUntilMonth: resignationMonthKeyFromDate(exitDate),
      status: 'unavailable',
      showInRoster: false,
    });
  } else {
    Object.assign(sourceSet, {
      employmentStatus: 'active',
      status: 'active',
    });
  }

  await Trainer.updateOne(
    { _id: sourceTrainer._id },
    {
      $set: sourceSet,
      $addToSet: { scheduleTrainerCodes: { $each: legacyCodesForSource } },
    }
  );

  if (sourceSubjectIds.length) {
    await applyTrainerSubjectsChange(sourceTrainer._id, sourceSubjectIds, []);
  }

  clearAttendanceGridCache();

  return {
    schedulesTransferred: ownedSchedules.length,
    subjectsTransferred: sourceSubjectIds.length,
    successorTrainerId: successorTrainer._id,
    sourceTrainerId: sourceTrainer._id,
    mode,
  };
}
