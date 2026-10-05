import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { canUseAiAssistant } from '../utils/aiAssistantAccess.js';
import AiAssistant from '../components/AiAssistant.jsx';
import SalluPet from '../components/SalluPet.jsx';
import Modal from '../components/Modal.jsx';
import { getAiUsage } from '../services/aiService.js';
// This announcement belongs to its original feature release; patch updates must not repeat it.
const SALLU_NOTICE_VERSION = '2.2.1';

const AiAssistantContext = createContext(null);
export const useAiAssistant = () => useContext(AiAssistantContext);

const AssistantSession = ({ children, enabled, userId, showRelease }) => {
  const [open, setOpen] = useState(false);
  const [petVisible, setPetVisible] = useState(() => window.innerWidth >= 768);
  const togglePet = useCallback(() => { setPetVisible(current => !current); setOpen(false); }, []);
  const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState(false);
  const noticeKey = `toms_sallu_notice:${userId}:${SALLU_NOTICE_VERSION}`;
  const [notice, setNotice] = useState(() => localStorage.getItem(noticeKey) !== 'seen');
  const mounted = useRef(true);
  const usageRequest = useRef(0);
  const refreshUsage = useCallback(async (signal) => {
    const requestId = ++usageRequest.current;
    try {
      const data = await getAiUsage(signal);
      if (mounted.current && requestId === usageRequest.current && !signal?.aborted) { setUsage(data); setUsageError(false); }
    } catch { if (mounted.current && requestId === usageRequest.current && !signal?.aborted) setUsageError(true); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (!enabled) return undefined;
    const controller = new AbortController();
    refreshUsage(controller.signal);
    const refresh = () => refreshUsage(controller.signal);
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { mounted.current = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [enabled, refreshUsage]);
  const dismissNotice = () => { localStorage.setItem(noticeKey, 'seen'); setNotice(false); };
  const launcher = useRef(null);
  const openAssistant = useCallback((event) => {
    launcher.current = event?.currentTarget || document.activeElement;
    setOpen(true);
  }, []);
  const closeAssistant = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => {
      if (launcher.current?.isConnected) launcher.current.focus();
      else document.querySelector('[aria-label="Open all pages"], [aria-label="Open Sallu"]')?.focus();
    });
  }, []);
  return (
    <AiAssistantContext.Provider value={{ enabled, open, openAssistant, closeAssistant, petVisible, togglePet }}>
      {children}
      {enabled && <SalluPet open={open} onOpen={openAssistant} visible={petVisible} onVisibilityChange={setPetVisible} />}
      {enabled && <AiAssistant open={open} onClose={closeAssistant} usage={usage} usageError={usageError} refreshUsage={refreshUsage} />}
      <Modal show={enabled && showRelease && notice && Boolean(usage || usageError)} title={`Welcome to TOMS v${SALLU_NOTICE_VERSION}`} onClose={dismissNotice} scrollable
        footer={<button type="button" className="btn btn-primary" onClick={dismissNotice}>Got it</button>}>
        <div className="toms-modal-body">
          <h3 className="h5">Sallu is now available to everyone</h3>
          <p>Ask about TOMS data you are permitted to view. Your existing account permissions still apply.</p>
          <ul>
            <li><strong>{usage?.questionsPerDay || 5} questions per day</strong> for each account.</li>
            <li><strong>{usage?.questionsPerMinute || 2} questions per minute</strong>, with one question processing at a time.</li>
            <li>Questions accepted for processing count toward your allowance, including failed answers and retries.</li>
            <li>A shared free API budget applies to everyone. Sallu pauses when it is exhausted.</li>
          </ul>
          <p>Daily limits reset at midnight Pacific time{usage?.resetAt ? ` — next reset: ${new Date(usage.resetAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST` : ''}.</p>
          {usage?.configured === false && <p role="status">The administrator still needs to configure the free API quotas before Sallu can answer.</p>}
          {usageError && <p role="status">Usage could not be loaded. Sallu’s backend still enforces all limits.</p>}
        </div>
      </Modal>
    </AiAssistantContext.Provider>
  );
};

export const AiAssistantProvider = ({ children }) => {
  const { user, loading } = useAuth();
  // Switching accounts, role, or trainer view destroys all private chat state.
  const sessionKey = `${user?._id}:${user?.role}:${user?.trainer}:${user?.impersonating}:${user?.mustResetPassword}`;
  return <AssistantSession key={sessionKey} userId={user?._id} showRelease={user?.appVersion === SALLU_NOTICE_VERSION} enabled={!loading && canUseAiAssistant(user)}>{children}</AssistantSession>;
};
