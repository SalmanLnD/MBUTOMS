import api from './api.js';

export const getClasses = async (params = {}) => {
  const { data } = await api.get('/classes', { params });
  return data;
};

export const getClassById = async (id) => {
  const { data } = await api.get(`/classes/${id}`);
  return data;
};

export const createClass = async (payload) => {
  const { data } = await api.post('/classes', payload);
  return data;
};

export const updateClass = async (id, payload) => {
  const { data } = await api.put(`/classes/${id}`, payload);
  return data;
};

export const deleteClass = async (id) => {
  const { data } = await api.delete(`/classes/${id}`);
  return data;
};
