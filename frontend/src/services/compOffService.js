import api from './api.js';

export const getCompOffs = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/comp-offs', { params, signal });
  return data;
};

export const getCompOffSummary = async ({ trainerId, employeeId } = {}, { signal } = {}) => {
  const path = trainerId
    ? `/comp-offs/summary/trainer/${trainerId}`
    : '/comp-offs/summary';
  const { data } = await api.get(path, {
    params: employeeId ? { employeeId } : undefined,
    signal,
  });
  return data;
};

export const createCompOff = async (payload) => {
  const { data } = await api.post('/comp-offs', payload);
  return data;
};

export const updateCompOff = async (id, payload) => {
  const { data } = await api.put(`/comp-offs/${id}`, payload);
  return data;
};

export const deleteCompOff = async (id) => {
  const { data } = await api.delete(`/comp-offs/${id}`);
  return data;
};
