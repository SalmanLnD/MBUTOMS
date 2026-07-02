import api from './api.js';

export const getLeaves = async (params = {}) => {
  const { data } = await api.get('/leaves', { params });
  return data;
};

export const createLeave = async (leaveData) => {
  const { data } = await api.post('/leaves', leaveData);
  return data;
};

export const updateLeave = async (id, leaveData) => {
  const { data } = await api.put(`/leaves/${id}`, leaveData);
  return data;
};

export const deleteLeave = async (id) => {
  const { data } = await api.delete(`/leaves/${id}`);
  return data;
};

export const previewAffectedSchedules = async (params) => {
  const { data } = await api.get('/leaves/preview/affected', { params });
  return data;
};
