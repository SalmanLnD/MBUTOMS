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

export const assignReplacement = async (leaveId, scheduleId, replacementTrainerId) => {
  const { data } = await api.post('/replacements/assign', {
    leaveId,
    scheduleId,
    replacementTrainerId,
  });
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
