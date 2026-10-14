import api from './api.js';

export const getDashboardStats = async () => {
  const { data } = await api.get('/dashboard/stats');
  return data;
};

export const getActionCounts = async () => {
  const { data } = await api.get('/dashboard/action-counts');
  return data;
};
