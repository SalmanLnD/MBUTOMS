let handler = null;
let sessionExpiredActive = false;
let pendingPayload = null;

export const registerSessionExpiredHandler = (fn) => {
  handler = fn;
  if (pendingPayload) {
    const payload = pendingPayload;
    pendingPayload = null;
    fn(payload);
  }
  return () => {
    if (handler === fn) handler = null;
  };
};

export const notifySessionExpired = ({ code = 'SESSION_EXPIRED', message } = {}) => {
  if (sessionExpiredActive) return;
  sessionExpiredActive = true;
  const payload = {
    code,
    message: message || 'Your session has expired. Please sign in again to continue with your updated access.',
  };
  if (handler) {
    handler(payload);
  } else {
    pendingPayload = payload;
  }
};

export const resetSessionExpiredState = () => {
  sessionExpiredActive = false;
  pendingPayload = null;
};

export const isSessionExpiredActive = () => sessionExpiredActive;
