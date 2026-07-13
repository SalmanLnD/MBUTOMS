let handler = null;
let sessionExpiredActive = false;

export const registerSessionExpiredHandler = (fn) => {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
};

export const notifySessionExpired = ({ code = 'SESSION_EXPIRED', message } = {}) => {
  if (sessionExpiredActive) return;
  sessionExpiredActive = true;
  handler?.({
    code,
    message: message || 'Your session has expired. Please sign in again to continue with your updated access.',
  });
};

export const resetSessionExpiredState = () => {
  sessionExpiredActive = false;
};

export const isSessionExpiredActive = () => sessionExpiredActive;
