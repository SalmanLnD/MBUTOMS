import api from './api.js';

export const getSchedules = async (params = {}) => {
  const { data } = await api.get('/schedules', { params });
  return data;
};

export const getPublicTimetable = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/schedules/public-timetable', { params, signal });
  return data;
};

export const getTimetableBoard = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/schedules/timetable-board', { params, signal });
  return data;
};

export const getLiveTrainerVenues = async ({ signal } = {}) => {
  const { data } = await api.get('/schedules/live-venues', { signal });
  return data;
};

export const getClassCancellationOptions = async (date) => {
  const { data } = await api.get('/schedules/class-cancellations/options', {
    params: { date },
  });
  return data;
};

export const createClassCancellation = async (payload) => {
  const { data } = await api.post('/schedules/class-cancellations', payload);
  return data;
};

export const deleteClassCancellation = async (id) => {
  const { data } = await api.delete(`/schedules/class-cancellations/${id}`);
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
