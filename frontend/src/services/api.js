import axios from 'axios';
import { notifySessionExpired } from '../utils/sessionManager.js';

/** True when a request failed because its AbortSignal was aborted. */
export const isAbortError = (error) =>
  axios.isCancel?.(error) || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

const isAuthLoginRequest = (config) => {
  const url = config?.url || '';
  return url.includes('/auth/login');
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('toms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const hadToken = Boolean(localStorage.getItem('toms_token'));
    const isLoginRequest = isAuthLoginRequest(error.config);

    if (status === 401 && hadToken && !isLoginRequest) {
      const data = error.response?.data;
      notifySessionExpired({
        code: data?.code || 'SESSION_EXPIRED',
        message: data?.message,
      });
    }

    return Promise.reject(error);
  }
);

export default api;
