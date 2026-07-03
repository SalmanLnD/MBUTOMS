import { toast } from 'react-toastify';

export const showSuccess = (message) => {
  if (!message) return;
  toast.success(message);
};

export const showError = (message) => {
  if (!message) return;
  toast.error(message);
};
