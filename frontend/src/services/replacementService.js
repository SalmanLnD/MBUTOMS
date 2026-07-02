import api from './api.js';

export const getPendingReplacements = async () => {
  const { data } = await api.get('/replacements/pending');
  return data;
};

export const getReplacementSuggestions = async (scheduleId) => {
  const { data } = await api.get(`/replacements/suggestions/${scheduleId}`);
  return data;
};

export const assignReplacement = async (scheduleId, replacementTrainerId) => {
  const { data } = await api.post('/replacements/assign', { scheduleId, replacementTrainerId });
  return data;
};
