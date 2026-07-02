import api from './api.js';

export const getSchedules = async (params = {}) => {
  const { data } = await api.get('/schedules', { params });
  return data;
};

export const getScheduleById = async (id) => {
  const { data } = await api.get(`/schedules/${id}`);
  return data;
};

export const getTrainerSchedule = async (trainerId, params = {}) => {
  const { data } = await api.get(`/schedules/trainer/${trainerId}`, { params });
  return data;
};

export const getVenueSchedule = async (venueId, params = {}) => {
  const { data } = await api.get(`/schedules/venue/${venueId}`, { params });
  return data;
};

export const createSchedule = async (scheduleData) => {
  const { data } = await api.post('/schedules', scheduleData);
  return data;
};

export const updateSchedule = async (id, scheduleData) => {
  const { data } = await api.put(`/schedules/${id}`, scheduleData);
  return data;
};

export const deleteSchedule = async (id) => {
  const { data } = await api.delete(`/schedules/${id}`);
  return data;
};

export const getBatches = async () => {
  const { data } = await api.get('/schedules/batches/list');
  return data;
};
