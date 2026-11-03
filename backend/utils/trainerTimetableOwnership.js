import { toLeaveDateKey } from './leaveDateRange.js';

const trainerIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

/**
 * A trainer-level transfer date cannot identify which individual slots moved.
 * Only the schedule's recorded ownershipStartDate is reliable evidence.
 */
export const inheritedOwnershipFloorsByTrainer = async (trainerIds = []) => {
  const ids = [...new Set(trainerIds.map(trainerIdString).filter(Boolean))];
  return new Map(ids.map((id) => [id, '']));
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
  // A generic floor cannot prove that any particular schedule was transferred.
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
