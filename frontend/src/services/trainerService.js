import api from './api.js';

export const getTrainers = async (params = {}) => {
  const { data } = await api.get('/trainers', { params });
  return data;
};

export const getTrainerById = async (id) => {
  const { data } = await api.get(`/trainers/${id}`);
  return data;
};

export const createTrainer = async (trainerData) => {
  const { data } = await api.post('/trainers', trainerData);
  return data;
};

export const updateTrainer = async (id, trainerData) => {
  const { data } = await api.put(`/trainers/${id}`, trainerData);
  return data;
};

export const deleteTrainer = async (id) => {
  const { data } = await api.delete(`/trainers/${id}`);
  return data;
};

export const getDepartments = async () => {
  const { data } = await api.get('/trainers/departments/list');
  return data;
};

export const resetTrainerPassword = async (id) => {
  const { data } = await api.post(`/trainers/${id}/reset-password`);
  return data;
};
