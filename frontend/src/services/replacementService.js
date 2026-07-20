import api from './api.js';

export const getAllReplacements = async (params = {}) => {
  const { data } = await api.get('/replacements/all', { params });
  return data;
};

export const getReplacementSuggestions = async (scheduleId, leaveId) => {
  const { data } = await api.get(`/replacements/suggestions/${scheduleId}`, {
    params: { leaveId },
  });
  return data;
};

export const getTrainerAvailability = async (params = {}) => {
  const { data } = await api.get('/replacements/availability', { params });
  return data;
};

export const assignReplacement = async (leaveId, scheduleId, options = {}) => {
  const payload = typeof options === 'string'
    ? { leaveId, scheduleId, replacementTrainerId: options }
    : {
      leaveId,
      scheduleId,
      ...(options.isExternal
        ? {
          isExternal: true,
          externalTrainerName: options.externalTrainerName,
        }
        : { replacementTrainerId: options.replacementTrainerId }),
    };
  const { data } = await api.post('/replacements/assign', payload);
  return data;
};

export const getTrainerSlotsForReplacement = async (params = {}) => {
  const { data } = await api.get('/replacements/trainer-slots', { params });
  return data;
};

export const createSlotReplacementRequest = async (payload) => {
  const { data } = await api.post('/replacements/slot-request', payload);
  return data;
};
