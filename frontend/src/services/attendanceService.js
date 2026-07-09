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

const gridRequestCache = new Map();
const GRID_CACHE_TTL_MS = 60_000;

export const getTrainerAttendanceGrid = async (params = {}, options = {}) => {
  const { preferCache = true, forceRefresh = false } = options;
  const cacheKey = JSON.stringify(params);
  const cached = gridRequestCache.get(cacheKey);
  const cacheFresh = cached && Date.now() - cached.cachedAt < GRID_CACHE_TTL_MS;

  if (preferCache && cacheFresh && !forceRefresh) {
    return cached.data;
  }

  const { data } = await api.get('/attendance/trainer-grid', {
    params: forceRefresh ? { ...params, refresh: '1' } : params,
  });
  gridRequestCache.set(cacheKey, { data, cachedAt: Date.now() });
  return data;
};

export const primeTrainerAttendanceGrid = (params, data) => {
  gridRequestCache.set(JSON.stringify(params), { data, cachedAt: Date.now() });
};

export const invalidateTrainerAttendanceGridCache = () => {
  gridRequestCache.clear();
};

export const upsertTrainerDailyAttendance = async (payload) => {
  const { data } = await api.put('/attendance/trainer-daily', payload);
  invalidateTrainerAttendanceGridCache();
  return data;
};

export const getTrainerPunchInLogs = async (params = {}) => {
  const { data } = await api.get('/attendance/trainer-punch-logs', { params });
  return data;
};

export const deleteTrainerPunchInLog = async (id) => {
  const { data } = await api.delete(`/attendance/trainer-punch-logs/${id}`);
  invalidateTrainerAttendanceGridCache();
  return data;
};
