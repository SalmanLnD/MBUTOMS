import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from './AuthContext.jsx';
import { isAcademicPage, setAcademicTransport, termLabel } from '../utils/academicTerm.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const AcademicTermContext = createContext(null);
export const useAcademicTerm = () => useContext(AcademicTermContext);

const readSelection = (key) => {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
};

export const AcademicTermProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = user?.role === 'admin' && !user?.impersonating && !user?.isDemo;
  const owner = String(user?._id || user?.id || 'public');
  const storageKey = `toms_academic_view:${owner}`;
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [epoch, setEpoch] = useState(0);
  const [pending, setPending] = useState(null);
  const dirty = useRef(false);
  const state = useRef({});
  state.current = { context, selectedId, isAdmin, storageKey, pathname, owner };
  const requestNumber = useRef(0);

  const apply = useCallback((data, selection) => {
    const terms = data.terms || [];
    const selected = terms.find((term) => String(term._id) === selection) || data.currentTerm;
    const generation = setAcademicTransport({ enabled: Boolean(data.enabled), termId: String(selected?._id || ''), revision: data.revision || 0, stale: false });
    setContext(data);
    setSelectedId(selection && selected?._id !== data.currentTerm?._id ? String(selected?._id || '') : '');
    setEpoch(generation);
    setPending(null);
    dirty.current = false;
  }, []);

  const refresh = useCallback(async ({ force = false } = {}) => {
    const requestedOwner = state.current.owner;
    const requestedAdmin = state.current.isAdmin;
    const number = ++requestNumber.current;
    const { data } = await api.get('/academic-terms/context', { skipRetry: true, skipSessionExpired: true });
    const current = state.current;
    if (number !== requestNumber.current || requestedOwner !== current.owner || requestedAdmin !== current.isAdmin) return data;
    const selection = current.isAdmin ? (current.selectedId || readSelection(current.storageKey)) : '';
    const changed = current.context?.enabled && (data.revision !== current.context.revision || data.currentTerm?._id !== current.context.currentTerm?._id);
    if (changed && dirty.current && isAcademicPage(current.pathname) && !force) {
      setPending(data);
      setAcademicTransport({ stale: true });
    } else if (!current.context || changed || force) apply(data, selection);
    else setContext(data);
    setError('');
    return data;
  }, [apply]);

  useEffect(() => {
    if (authLoading) return undefined;
    let active = true;
    // Reset identity-scoped state before fetching another user's permissions.
    state.current.context = null;
    state.current.selectedId = '';
    setContext(null);
    setSelectedId('');
    setPending(null);
    dirty.current = false;
    setAcademicTransport({ enabled: false, termId: '', revision: 0, stale: false });
    refresh().catch((err) => { if (active) setError(err.response?.data?.message || 'Unable to load semester settings.'); });
    const poll = () => { if (!document.hidden && active) refresh().catch(() => {}); };
    const interval = window.setInterval(poll, 30_000);
    window.addEventListener('focus', poll);
    window.addEventListener('toms-academic-stale', poll);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', poll); window.removeEventListener('toms-academic-stale', poll); };
  }, [authLoading, owner, isAdmin, refresh]);

  useEffect(() => { dirty.current = false; }, [pathname]);
  useEffect(() => {
    const changed = (event) => {
      if (isAcademicPage(state.current.pathname) && !event.target.closest?.('[data-academic-controls]')
        && !['password', 'search'].includes(event.target.type)) dirty.current = true;
    };
    document.addEventListener('input', changed, true);
    document.addEventListener('change', changed, true);
    return () => { document.removeEventListener('input', changed, true); document.removeEventListener('change', changed, true); };
  }, []);

  const selectTerm = (id) => {
    if (!isAdmin || !context) return;
    if (dirty.current && !window.confirm('Changing semester will close this page and discard unsaved edits. Continue?')) return;
    try { id ? sessionStorage.setItem(storageKey, id) : sessionStorage.removeItem(storageKey); } catch { /* tab preference is optional */ }
    apply(context, id);
  };

  const downloadEdits = () => {
    const fields = [...document.querySelectorAll('main input, main textarea, main select, .toms-modal-dialog input, .toms-modal-dialog textarea, .toms-modal-dialog select')]
      .filter((field) => !['password', 'file', 'hidden'].includes(field.type) && !field.closest('[data-academic-controls]'))
      .map((field) => ({ label: field.labels?.[0]?.textContent?.trim() || field.name || field.id || field.getAttribute('aria-label') || field.placeholder || 'Field', value: ['checkbox', 'radio'].includes(field.type) ? field.checked : field.value }));
    const snapshot = JSON.stringify({ semester: termLabel(context?.terms?.find((term) => String(term._id) === selectedId) || context?.currentTerm), page: pathname, fields }, null, 2);
    const url = URL.createObjectURL(new Blob([snapshot], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'unsaved-semester-edits.json'; link.click(); URL.revokeObjectURL(url);
  };

  const viewedTerm = context?.terms?.find((term) => String(term._id) === selectedId) || context?.currentTerm;
  const value = { ...context, isAdmin, viewedTerm, selectedId, epoch, pending, error, refresh, selectTerm, downloadEdits,
    acceptPublication: () => apply(pending || context, selectedId), loading: !context && !error };

  return <AcademicTermContext.Provider value={value}>
    {!context ? error ? <div className="container py-5" role="alert"><p>{error}</p><button type="button" className="btn btn-primary" onClick={() => refresh().catch((err) => setError(err.response?.data?.message || 'Unable to load semester settings.'))}>Retry semester settings</button></div>
      : <LoadingSpinner fullPage message="Loading semester settings..." /> : children}
  </AcademicTermContext.Provider>;
};
