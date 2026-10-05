export const isIosDevice = (navigator) => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = (window, navigator) => Boolean(navigator.standalone
  || window.matchMedia('(display-mode: standalone)').matches);

export const pushSupportReason = (window, navigator) => {
  if (!window.isSecureContext) return 'Open TOMS over HTTPS to enable device notifications.';
  if (isIosDevice(navigator) && !isStandalone(window, navigator)) {
    return 'Add TOMS to your Home Screen, then open it there to enable notifications (iOS/iPadOS 16.4 or later).';
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'This browser does not support device notifications. Your TOMS inbox still works.';
  }
  return '';
};

export const decodeApplicationKey = (key) => {
  const value = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(value, char => char.charCodeAt(0));
};
