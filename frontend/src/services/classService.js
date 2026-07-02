import api from './api.js';

export const getClasses = async (params = {}) => {
  const { data } = await api.get('/classes', { params });
  return data;
};
