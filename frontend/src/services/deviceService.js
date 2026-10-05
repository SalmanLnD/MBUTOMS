import api from './api.js';
import { decodeApplicationKey, pushSupportReason } from '../utils/pwaSupport.js';
import { version } from '../../package.json';

const PREFERENCE_KEY = 'toms_push_device';
const INSTALLED_KEY = 'toms_installed_on_device';
const setupSessionKey = (userId) => `toms_device_setup_session:${userId}:${version}`;
export const hasAcknowledgedDeviceSetup = (userId) => {
  try { return sessionStorage.getItem(setupSessionKey(userId)) === 'done'; }
  catch { return false; }
};
export const acknowledgeDeviceSetup = (userId) => {
  try { sessionStorage.setItem(setupSessionKey(userId), 'done'); } catch { /* Current modal still closes when storage is unavailable. */ }
};
export const hasInstalledToms = () => {
  try { return localStorage.getItem(INSTALLED_KEY) === 'true'; } catch { return false; }
};
export const acknowledgeTomsInstallation = () => {
  try { localStorage.setItem(INSTALLED_KEY, 'true'); } catch { /* Standalone detection remains available. */ }
  changed();
};
let workerPromise;
let installPrompt = null;
const changed = () => window.dispatchEvent(new Event('toms-device-change'));
export const getInstallPrompt = () => installPrompt;

export const initializeDeviceFeatures = () => {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
    try { localStorage.removeItem(INSTALLED_KEY); } catch { /* Storage can be restricted. */ }
    changed();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; acknowledgeTomsInstallation(); });
  if (window.isSecureContext && 'serviceWorker' in navigator) {
    workerPromise = navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready);
    workerPromise.catch(() => {});
  }
};

export const getDeviceWorker = () => workerPromise || Promise.reject(new Error('Service worker unavailable.'));

export const installToms = async () => {
  const prompt = installPrompt;
  if (!prompt) return false;
  installPrompt = null;
  try { await prompt.prompt(); return (await prompt.userChoice).outcome === 'accepted'; }
  finally { changed(); }
};

export const getPushPreference = () => {
  try { return JSON.parse(localStorage.getItem(PREFERENCE_KEY)) || null; }
  catch { return null; }
};

const setWorkerOwner = (registration, recipient) => new Promise((resolve, reject) => {
  const channel = new MessageChannel();
  const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Notification setup timed out.')); }, 4000);
  channel.port1.onmessage = event => {
    clearTimeout(timer); channel.port1.close();
    event.data?.ok ? resolve() : reject(new Error('Cannot store notification preference.'));
  };
  registration.active.postMessage({ type: 'TOMS_PUSH_OWNER', recipient }, [channel.port2]);
});

export const getPushConfig = async () => (await api.get('/notifications/push/config')).data;

const saveSubscription = async (subscription, publicKey) => {
  await api.post('/notifications/push/subscription', { subscription: subscription.toJSON(), publicKey });
};

export const enableDevicePush = async ({ registration, config, user }) => {
  const reason = pushSupportReason(window, navigator);
  if (reason) throw new Error(reason);
  if (!config?.configured || !registration?.active || !user || user.impersonating || user.isDemo || user.role === 'demo') throw new Error('Device notifications are not ready yet.');
  // Called directly from the button: Safari requires a user gesture for permission.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Notifications are blocked. Allow them in your browser or device settings to try again.' : 'Notification permission was not granted.');
  let subscription = await registration.pushManager.getSubscription();
  const preference = getPushPreference();
  if (subscription && preference?.publicKey !== config.publicKey) {
    await subscription.unsubscribe(); subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeApplicationKey(config.publicKey) });
  try {
    await setWorkerOwner(registration, user._id);
    await saveSubscription(subscription, config.publicKey);
    localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ recipient: user._id, publicKey: config.publicKey }));
    changed();
  } catch (error) {
    await setWorkerOwner(registration, null).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
    localStorage.removeItem(PREFERENCE_KEY); changed(); throw error;
  }
};

export const disableDevicePush = async () => {
  if (JSON.parse(localStorage.getItem('toms_user') || 'null')?.isDemo) return;
  localStorage.removeItem(PREFERENCE_KEY); changed();
  try {
    const registration = await getDeviceWorker();
    await setWorkerOwner(registration, null).catch(() => {});
    const subscription = await registration.pushManager?.getSubscription();
    if (!subscription) return;
    // Revoke the browser subscription even if the API is offline at logout.
    await subscription.unsubscribe();
    await api.delete('/notifications/push/subscription', {
      data: { endpoint: subscription.endpoint }, timeout: 3000, skipRetry: true, skipSessionExpired: true,
    }).catch(() => {});
  } catch { /* Unsupported browsers have nothing to revoke. */ }
};

export const endDeviceSetupSession = (userId) => {
  try { sessionStorage.removeItem(setupSessionKey(userId)); } catch { /* No stored prompt to clear. */ }
};

export const syncDeviceSession = async (user) => {
  if (user?.impersonating || user?.isDemo || user?.role === 'demo') return;
  const preference = getPushPreference();
  // Browser storage can be cleared separately from the worker's IndexedDB.
  // An unbound/new account must not inherit the previous worker identity.
  if (!preference) { await disableDevicePush(); return; }
  if (!user || preference.recipient !== user._id || window.Notification?.permission !== 'granted') {
    await disableDevicePush(); return;
  }
  try {
    const registration = await getDeviceWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) { await disableDevicePush(); return; }
    await setWorkerOwner(registration, user._id);
    await saveSubscription(subscription, preference.publicKey);
  } catch { /* Retry on the next session check; preserve explicit opt-in when offline. */ }
};
