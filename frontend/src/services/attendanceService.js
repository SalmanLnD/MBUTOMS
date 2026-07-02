import api from './api.js';

export const getAttendance = async (params = {}) => {
  const { data } = await api.get('/attendance', { params });
  return data;
};

export const markAttendance = async (record) => {
  const { data } = await api.post('/attendance', record);
  return data;
};

export const updateAttendance = async (id, record) => {
  const { data } = await api.put(`/attendance/${id}`, record);
  return data;
};

export const getAttendanceSummary = async (params = {}) => {
  const { data } = await api.get('/attendance/summary', { params });
  return data;
};

export const getTrainerAttendanceGrid = async (params = {}) => {
  const { data } = await api.get('/attendance/trainer-grid', { params });
  return data;
};

export const upsertTrainerDailyAttendance = async (payload) => {
  const { data } = await api.put('/attendance/trainer-daily', payload);
  return data;
};
