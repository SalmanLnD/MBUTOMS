import api from './api.js';

export const login = async (credentials) => {
  const { data } = await api.post('/auth/login', credentials);
  return data;
};

export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const logout = async () => {
  const { data } = await api.post('/auth/logout');
  return data;
};

export const resetPassword = async (payload) => {
  const { data } = await api.post('/auth/reset-password', payload);
  return data;
};

export const getImpersonationTargets = async () => {
  const { data } = await api.get('/auth/impersonation-targets');
  return data;
};

export const impersonateUser = async (userId) => {
  const { data } = await api.post('/auth/impersonate', { userId });
  return data;
};

export const stopImpersonation = async () => {
  const { data } = await api.post('/auth/stop-impersonation');
  return data;
};
