import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { getActionCounts } from '../services/dashboardService.js';

export const ACTION_COUNTS_EVENT = 'toms-action-counts';

export const refreshActionCounts = () => {
  window.dispatchEvent(new Event(ACTION_COUNTS_EVENT));
};

const EMPTY = {
  tickets: 0,
  latePunches: 0,
  cancellations: 0,
  leaves: 0,
  replacements: 0,
};

const ActionCountsContext = createContext({ counts: EMPTY, refresh: () => {} });

export const ActionCountsProvider = ({ children }) => {
  const { hasFullAccess, user } = useAuth();
  const location = useLocation();
  const [counts, setCounts] = useState(EMPTY);
  const canSee = Boolean(user) && hasFullAccess();

  const refresh = useCallback(async () => {
    if (!canSee) {
      setCounts(EMPTY);
      return;
    }
    try {
      const data = await getActionCounts();
      setCounts({ ...EMPTY, ...data });
    } catch {
      // The badge is a hint. A failed refresh should not interrupt the page.
    }
  }, [canSee]);

  useEffect(() => {
    if (!canSee) {
      setCounts(EMPTY);
      return undefined;
    }
    refresh();
    const intervalId = window.setInterval(refresh, 60000);
    window.addEventListener(ACTION_COUNTS_EVENT, refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(ACTION_COUNTS_EVENT, refresh);
    };
  }, [canSee, location.pathname, refresh]);

  const value = useMemo(() => ({ counts, refresh }), [counts, refresh]);
  return (
    <ActionCountsContext.Provider value={value}>
      {children}
    </ActionCountsContext.Provider>
  );
};

export const useActionCounts = () => useContext(ActionCountsContext);
