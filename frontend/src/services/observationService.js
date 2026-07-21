import api from './api.js';

export const getObservations = async (params = {}) => {
  const { data } = await api.get('/observations', { params });
  return data;
};

export const upsertObservation = async (trainerId, payload) => {
  const { data } = await api.put(`/observations/${trainerId}`, payload);
  return data;
};
