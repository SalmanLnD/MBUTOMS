import { useContext, useEffect, useRef, useState } from 'react';
import { AsyncActionScopeContext } from '../context/AsyncActionScope.jsx';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

/** Lock before React renders, and release on both success and failure. */
export const useAsyncAction = () => {
  const scope = useContext(AsyncActionScopeContext);
  const locked = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = (event, handler) => {
    if (locked.current || scope?.hasPending()) {
      event?.preventDefault();
      return;
    }
    if (!handler) return;
    locked.current = true;
    let result;
    try { result = handler(event); } catch (error) {
      locked.current = false;
      showError(getErrorMessage(error));
      return;
    }
    if (!result || typeof result.then !== 'function') {
      locked.current = false;
      return result;
    }
    const release = scope?.acquire();
    setPending(true);
    return Promise.resolve(result).catch(error => {
      // Most callers show their own errors; surface any uncaught failure too.
      showError(getErrorMessage(error));
    }).finally(() => {
      locked.current = false;
      release?.();
      if (mounted.current) setPending(false);
    });
  };

  return { pending, scopePending: Boolean(scope?.pending), run };
};
