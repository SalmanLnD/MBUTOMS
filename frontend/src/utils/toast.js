import { toast } from 'react-toastify';
import { API_RECONNECTING_MESSAGE } from './helpers.js';

export const showSuccess = (message) => {
  if (!message) return;
  toast.success(message);
};

export const showError = (message) => {
  if (!message) return;
  // Collapse spam while Render free tier is waking/restarting.
  if (message === API_RECONNECTING_MESSAGE) {
    toast.error(message, { toastId: 'api-reconnecting' });
    return;
  }
  toast.error(message);
};
