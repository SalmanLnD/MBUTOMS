import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from './Modal.jsx';
import api from '../services/api.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';
import '../styles/feedback-announcement.css';

const FeedbackAnnouncement = () => {
  const { user, loading } = useAuth();
  const location = useLocation(), navigate = useNavigate();
  const [payload, setPayload] = useState(null), [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(5), [saving, setSaving] = useState(false);
  const openedFor = useRef('');
  const requested = new URLSearchParams(location.search).get('announcement');
  useEffect(() => {
    if (loading || !user || user.impersonating || user.mustResetPassword || user.requiresPasswordReset) return undefined;
    let active = true, timer;
    setOpen(false);
    api.get('/announcements/current').then(({ data }) => {
      if (!active || !data.announcement) return;
      setPayload(data);
      const manual = requested === data.announcement.id;
      if (!manual && (data.dismissed || data.preview || user.isDemo || openedFor.current === user._id)) return;
      // Avoid stacking this announcement on the install/password/other dialogs.
      timer = setInterval(() => {
        if (!document.querySelector('.toms-modal-overlay')) {
          openedFor.current = user._id; setOpen(true); clearInterval(timer);
        }
      }, 300);
    }).catch(error => { if (active && requested) showError(getErrorMessage(error)); });
    return () => { active = false; clearInterval(timer); };
  }, [loading, user?._id, user?.impersonating, user?.mustResetPassword, user?.requiresPasswordReset, requested]);
  useEffect(() => {
    if (!open) return undefined;
    setRemaining(5);
    const unlockAt = Date.now() + 5000;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [open]);
  const close = async () => {
    if (remaining || saving || !payload) return;
    setSaving(true);
    try {
      if (!payload.preview && !user.isDemo) await api.post(`/announcements/${payload.announcement.id}/dismiss`);
      setPayload(current => ({ ...current, dismissed: true })); setOpen(false);
      if (requested) {
        const params = new URLSearchParams(location.search); params.delete('announcement');
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
      }
    } catch (error) { showError(getErrorMessage(error)); }
    finally { setSaving(false); }
  };
  if (!payload) return null;
  const announcement = payload.announcement;
  return <Modal show={open} title={announcement.title} onClose={close} size="toms-modal-lg" scrollable
    dismissible={!remaining && !saving} closeDisabled={Boolean(remaining || saving)} className="feedback-announcement"
    footer={<span className="text-muted small" role="status">{remaining ? `Close unlocks in ${remaining}s` : saving ? 'Saving…' : 'Thanks for being part of TOMS! You can read this again from Notifications.'}</span>}>
    <div className="toms-modal-body">
      <p className="feedback-announcement-intro">{announcement.intro}</p>
      <ol className="feedback-announcement-list">{announcement.items.map(item => <li key={item.request}>
        <h3>{item.request}</h3><p>{item.response}</p>
      </li>)}</ol>
      <p className="feedback-announcement-thanks">{announcement.closing}</p>
    </div>
  </Modal>;
};
export default FeedbackAnnouncement;
