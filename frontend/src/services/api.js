import axios from 'axios';
import { notifySessionExpired } from '../utils/sessionManager.js';
import { createDemoWorkspace, isDemoUser, demoNetworkActions } from '../utils/demoWorkspace.js';

export const demoWorkspace = createDemoWorkspace(window.localStorage, () => window.dispatchEvent(new Event('toms-demo-change')));
const cachedUser = () => { try { return JSON.parse(localStorage.getItem('toms_user') || 'null'); } catch { return null; } };
const requestPath = (config) => new URL(config.url, 'https://toms.invalid').pathname.replace(/^\/api(?=\/)/, '');

/** True when a request failed because its AbortSignal was aborted. */
export const isAbortError = (error) =>
  axios.isCancel?.(error)
  || error?.code === 'ERR_CANCELED'
  || error?.name === 'CanceledError'
  || error?.name === 'AbortError';

const MAX_TRANSIENT_RETRIES = 1;
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
  const user = cachedUser(), path = requestPath(config), method = config.method?.toLowerCase() || 'get';
  if (isDemoUser(user) && token) {
    config.demoOwner = user.demoAccountId || user._id;
    const localDetail = method === 'get' && demoWorkspace.localDetail(config.demoOwner, path);
    if (localDetail || (method !== 'get' && !demoNetworkActions.has(path))) {
      config.adapter = async (request) => ({ status: 200, statusText: 'OK', headers: {}, config: request,
        data: localDetail || demoWorkspace.mutate(request.demoOwner, path, method, request.data) });
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const { config } = response, user = cachedUser();
    if (config.demoOwner && isDemoUser(user) && config.demoOwner === (user.demoAccountId || user._id)
      && config.method === 'get' && !requestPath(config).startsWith('/auth/')) {
      const path = requestPath(config);
      demoWorkspace.remember(config.demoOwner, path, config.params, response.data);
      response.data = demoWorkspace.project(config.demoOwner, path, config.params, response.data);
    }
    return response;
  },
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const hadToken = Boolean(localStorage.getItem('toms_token'));
    const isLoginRequest = isAuthLoginRequest(config);

    if (status === 401 && hadToken && !isLoginRequest && !config?.skipSessionExpired) {
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
      && error.code !== 'ECONNABORTED'
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
