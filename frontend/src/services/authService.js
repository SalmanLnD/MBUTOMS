import api from './api.js';

export const login = async (credentials) => {
  const { data } = await api.post('/auth/login', credentials);
  // Do not enter the app until the browser has returned the session cookie.
  const session = await getMe({ skipSessionExpired: true, skipRetry: true });
  if (!data?._id || session._id !== data._id) {
    throw new Error('Unable to verify your sign-in session. Please try again.');
  }
  return session;
};

export const getMe = async (config) => {
  const { data } = await api.get('/auth/me', config);
  if (!data?._id || !data.role) {
    throw new Error('The sign-in service is unavailable. Please try again shortly.');
  }
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
