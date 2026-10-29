import Trainer from '../models/Trainer.js';
import { toLeaveDateKey } from './leaveDateRange.js';

const trainerIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

/**
 * A permanent handover rewrites trainerCode immediately, while the successor
 * only takes those classes from roleTransferEffectiveDate. When every inbound
 * handover shares one date, that date is the first day the successor owns the
 * timetable they hold now.
 */
export const inheritedOwnershipFloorsByTrainer = async (trainerIds = []) => {
  const ids = [...new Set(trainerIds.map(trainerIdString).filter(Boolean))];
  const floors = new Map(ids.map((id) => [id, '']));
  if (!ids.length) return floors;

  const sources = await Trainer.find({
    successorTrainer: { $in: ids },
    roleTransferEffectiveDate: { $ne: null },
  })
    .select('successorTrainer roleTransferEffectiveDate')
    .lean();

  const keysBySuccessor = new Map();
  sources.forEach((source) => {
    const successorId = trainerIdString(source.successorTrainer);
    const key = toLeaveDateKey(source.roleTransferEffectiveDate);
    if (!successorId || !key) return;
    if (!keysBySuccessor.has(successorId)) keysBySuccessor.set(successorId, new Set());
    keysBySuccessor.get(successorId).add(key);
  });

  keysBySuccessor.forEach((keys, successorId) => {
    if (keys.size === 1) floors.set(successorId, [...keys][0]);
  });
  return floors;
};

export const inheritedOwnershipFloorKey = async (trainerId) => {
  const floors = await inheritedOwnershipFloorsByTrainer([trainerId]);
  return floors.get(trainerIdString(trainerId)) || '';
};

export const isScheduleOwnedOnDate = (schedule, dateKey) => {
  const startKey = toLeaveDateKey(schedule?.ownershipStartDate);
  if (!startKey || !dateKey) return true;
  return dateKey >= startKey;
};

export const applyOwnershipFloor = (schedules = [], floorKey = '') => {
  if (!floorKey) return schedules;
  schedules.forEach((schedule) => {
    if (!schedule || toLeaveDateKey(schedule.ownershipStartDate)) return;
    schedule.ownershipStartDate = floorKey;
  });
  return schedules;
};

export const applyOwnershipFloorsToTrainerSchedules = (schedulesByTrainer, floors) => {
  floors.forEach((floorKey, trainerId) => {
    applyOwnershipFloor(schedulesByTrainer.get(trainerId) || [], floorKey);
  });
};

export const applyOwnershipFloorsToLeaves = async (leaves = []) => {
  const floors = await inheritedOwnershipFloorsByTrainer(leaves.map((leave) => leave?.trainer));
  leaves.forEach((leave) => {
    const trainerId = trainerIdString(leave?.trainer);
    applyOwnershipFloor(leave?.affectedSchedules || [], floors.get(trainerId) || '');
  });
  return leaves;
};
