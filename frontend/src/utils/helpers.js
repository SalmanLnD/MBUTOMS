import { ROLES } from './roles.js';

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatRole = (role) => {
  const roles = {
    [ROLES.ADMIN]: 'Admin',
    [ROLES.MANAGER]: 'Manager',
    [ROLES.SUBJECT_COORDINATOR]: 'Subject Coordinator',
    [ROLES.CAMPUS_MANAGER]: 'Campus Manager',
    [ROLES.EVALUATOR]: 'Evaluator',
    [ROLES.TRAINER]: 'Trainer',
  };
  return roles[role] || role;
};

export const formatStatus = (status) =>
  status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '-';

/** True for wake/restart/network drops where the API never returned a body. */
export const isTransientApiError = (error) => {
  if (!error) return false;
  if (
    error.code === 'ERR_CANCELED'
    || error.name === 'CanceledError'
    || error.name === 'AbortError'
  ) {
    return false;
  }
  const status = error.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
  if (error.message === 'Network Error') return true;
  return !error.response && Boolean(error.request);
};

export const API_RECONNECTING_MESSAGE =
  'Server is reconnecting. Wait a moment and try again.';

export const getErrorMessage = (error) => {
  const apiMessage = error?.response?.data?.message;
  if (apiMessage) return apiMessage;
  if (isTransientApiError(error)) return API_RECONNECTING_MESSAGE;
  return error?.message || 'Something went wrong';
};

export const resolveLinkedTrainerId = (trainer) => {
  if (!trainer) return null;
  if (typeof trainer === 'string') return trainer;
  if (typeof trainer === 'object' && trainer._id) return trainer._id.toString();
  return null;
};

export const toInputDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const toInputTime = (date = new Date()) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};
