import { useEffect, useRef, useState } from 'react';
import { version } from '../../package.json';
import { useAuth } from '../context/AuthContext.jsx';
import { BellIcon, DownloadIcon } from './icons.jsx';
import Modal from './Modal.jsx';
import { getErrorMessage } from '../utils/helpers.js';
import { isIosDevice, isStandalone, pushSupportReason } from '../utils/pwaSupport.js';
import {
  getDeviceWorker, getInstallPrompt, getPushConfig, getPushPreference,
  installToms, enableDevicePush, disableDevicePush,
  hasInstalledToms, acknowledgeTomsInstallation,
  hasAcknowledgedDeviceSetup, acknowledgeDeviceSetup,
} from '../services/deviceService.js';
import '../styles/device-settings.css';

const DeviceSettings = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [registration, setRegistration] = useState(null);
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [guide, setGuide] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [retry, setRetry] = useState(0);
  const promptedUser = useRef(null);
  const ios = isIosDevice(navigator);
  const standalone = isStandalone(window, navigator);
  const installed = standalone || hasInstalledToms();
  const supportReason = pushSupportReason(window, navigator);
  const enabled = Boolean(user && getPushPreference()?.recipient === user._id && window.Notification?.permission === 'granted');

  useEffect(() => {
    if (standalone) acknowledgeTomsInstallation();
  }, [standalone]);

  useEffect(() => {
    if (!user) { promptedUser.current = null; setSetupRequired(false); setOpen(false); return; }
    if (loading || user.appVersion !== version || user.impersonating || user.mustResetPassword || user.requiresPasswordReset
      || promptedUser.current === user._id || hasAcknowledgedDeviceSetup(user._id)) return;
    promptedUser.current = user._id;
    if (installed && enabled) { acknowledgeDeviceSetup(user._id); return; }
    setSetupRequired(true); setOpen(true);
  }, [loading, user?._id, user?.appVersion, user?.impersonating, user?.mustResetPassword, user?.requiresPasswordReset, installed, enabled]);

  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener('toms-device-change', update);
    window.addEventListener('focus', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('toms-device-change', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  useEffect(() => {
    let current = true;
    setConfig(null); setLoadError(false);
    if (!user || user.impersonating || supportReason) return undefined;
    Promise.all([getDeviceWorker(), getPushConfig()]).then(([worker, settings]) => {
      if (current) { setRegistration(worker); setConfig(settings); }
    }).catch(() => { if (current) setLoadError(true); });
    return () => { current = false; };
  }, [user?._id, user?.impersonating, supportReason, open, retry]);

  const handleInstall = async () => {
    setMessage('');
    if (!getInstallPrompt()) { setGuide(true); return; }
    setBusy(true);
    try {
      const accepted = await installToms();
      setMessage(accepted ? 'Installation started. Open TOMS from your Home Screen or app launcher.'
        : setupRequired ? 'You can retry installation or use the browser menu.' : 'You can install TOMS later.');
      if (!accepted) setGuide(true);
    } catch (error) { setMessage(getErrorMessage(error)); setGuide(true); }
    finally { setBusy(false); }
  };

  const handleNotifications = async () => {
    setBusy(true); setMessage('');
    try {
      if (enabled) {
        await disableDevicePush(); setMessage('Device notifications are off. Your TOMS inbox is still available.');
      } else {
        await enableDevicePush({ registration, config, user });
        setMessage('Device notifications are on for this account on this device.');
      }
    } catch (error) { setMessage(getErrorMessage(error)); }
    finally { setBusy(false); setRefresh(value => value + 1); }
  };

  const notificationReason = !user ? 'Sign in to enable notifications for your account.'
    : user.impersonating ? 'Exit trainer view to change device notifications.'
      : supportReason || (window.Notification?.permission === 'denied'
        ? 'Notifications are blocked. Allow TOMS in your browser or device notification settings.'
        : loadError ? 'Cannot connect right now. Retry setup, or continue for this session.'
          : config && !config.configured ? 'Device notifications will be available after server setup.'
            : !registration || !config ? 'Checking notification availability…' : '');

  // Browsers cannot force an install or override an OS permission denial.
  // Keep an explicit fallback for unsupported/blocked/offline setups rather than stranding staff.
  const pushUnavailable = Boolean((supportReason && !(ios && !standalone))
    || window.Notification?.permission === 'denied' || loadError || config?.configured === false);
  const canContinue = (installed && enabled) || pushUnavailable;
  const finishSetup = () => {
    if (!canContinue || busy) return;
    acknowledgeDeviceSetup(user._id); setSetupRequired(false); setOpen(false);
  };

  return <>
    <button type="button" className="btn btn-outline-primary btn-sm device-settings-trigger"
      aria-label="Install TOMS and notifications" title="Install TOMS & notifications" onClick={() => { setOpen(true); setMessage(''); }}>
      <DownloadIcon size={18} />
    </button>
    <Modal show={open} onClose={() => { if (!busy && !setupRequired) setOpen(false); }}
      title={setupRequired ? `Set up TOMS v${version}` : 'TOMS on this device'} dismissible={!busy && !setupRequired} scrollable
      footer={setupRequired && <button type="button" className="btn btn-primary" onClick={finishSetup} disabled={busy || !canContinue}>
        {pushUnavailable ? 'Continue without notifications' : 'Continue to TOMS'}
      </button>}>
      <div className="toms-modal-body device-settings" data-refresh={refresh}>
        {setupRequired && <p className="device-setup-intro">Add TOMS to your device and enable notifications to continue. You can access all your usual pages from the installed app.</p>}
        <section className="device-settings-card" aria-labelledby="device-install-title">
          <div className="device-settings-heading"><DownloadIcon size={22} /><h3 id="device-install-title">Keep TOMS a tap away</h3></div>
          <p>Open your dashboard from a TOMS icon on your Home Screen or desktop app launcher.</p>
          <button type="button" className="btn btn-primary" onClick={handleInstall} disabled={installed || busy}>
            {installed ? 'TOMS is installed' : 'Add to Home Screen'}
          </button>
          {!installed && (guide || ios) && <div className="device-install-guide">
            {ios ? <ol><li>Open TOMS in Safari and tap the Share button.</li><li>Choose <strong>Add to Home Screen</strong> (you may need to scroll).</li><li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li></ol>
              : <p>Open your browser menu and choose <strong>Install TOMS</strong>, <strong>Install app</strong>, or <strong>Add to Home Screen</strong>. If no install option appears, open TOMS in Chrome or Edge, or create a browser shortcut to the dashboard.</p>}
            {ios && <p className="device-settings-hint">After adding it, open TOMS from your Home Screen to finish setup.</p>}
            {!ios && !getInstallPrompt() && <button type="button" className="btn btn-outline-primary btn-sm" onClick={acknowledgeTomsInstallation}>
              I've added the shortcut
            </button>}
          </div>}
        </section>
        <section className="device-settings-card" aria-labelledby="device-push-title">
          <div className="device-settings-heading"><BellIcon size={22} /><h3 id="device-push-title">Stay up to date</h3></div>
          <p>Receive your replacements, ticket updates, observations and tracker alerts, even when TOMS is closed.</p>
          {notificationReason && <p className="device-settings-note">{notificationReason}</p>}
          <button type="button" className={`btn ${enabled ? 'btn-outline-secondary' : 'btn-primary'}`}
            onClick={handleNotifications} disabled={busy || (!enabled && Boolean(notificationReason)) || user?.impersonating || (setupRequired && enabled)}>
            {busy ? 'Please wait…' : enabled ? setupRequired ? 'Notifications enabled' : 'Turn off device notifications' : 'Enable notifications'}
          </button>
          {loadError && <button type="button" className="btn btn-outline-primary ms-2" onClick={() => setRetry(value => value + 1)}>Retry setup</button>}
          <p className="device-settings-hint">You choose whether to allow notifications. This setting applies to this device.</p>
        </section>
        {message && <p role="status" className="device-settings-status">{message}</p>}
      </div>
    </Modal>
  </>;
};

export default DeviceSettings;
