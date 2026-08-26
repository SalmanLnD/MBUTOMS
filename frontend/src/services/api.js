import axios from 'axios';
import { notifySessionExpired } from '../utils/sessionManager.js';

/** True when a request failed because its AbortSignal was aborted. */
export const isAbortError = (error) =>
  axios.isCancel?.(error)
  || error?.code === 'ERR_CANCELED'
  || error?.name === 'CanceledError'
  || error?.name === 'AbortError';

const MAX_TRANSIENT_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

/** Render free-tier wake / restart style failures with no usable response body. */
export const isTransientApiError = (error) => {
  if (!error || isAbortError(error)) return false;
  const status = error.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
  if (error.message === 'Network Error') return true;
  return !error.response && Boolean(error.request);
};

const isAuthLoginRequest = (config) => {
  const url = config?.url || '';
  return url.includes('/auth/login');
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('toms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const hadToken = Boolean(localStorage.getItem('toms_token'));
    const isLoginRequest = isAuthLoginRequest(config);

    if (status === 401 && hadToken && !isLoginRequest) {
      const data = error.response?.data;
      notifySessionExpired({
        code: data?.code || 'SESSION_EXPIRED',
        message: data?.message,
      });
      return Promise.reject(error);
    }

    if (
      config
      && !config.skipRetry
      && !isAbortError(error)
      && isTransientApiError(error)
    ) {
      const retryCount = config.__retryCount || 0;
      if (retryCount < MAX_TRANSIENT_RETRIES) {
        config.__retryCount = retryCount + 1;
        const delayMs = Math.min(2000 * (2 ** retryCount), 10_000);
        await sleep(delayMs);
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
