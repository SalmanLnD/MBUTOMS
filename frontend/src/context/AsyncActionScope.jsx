import { createContext, useCallback, useMemo, useRef, useState } from 'react';

export const AsyncActionScopeContext = createContext(null);
export const AsyncFormContext = createContext(false);

/** A dialog's controls and close routes share the same synchronous busy lock. */
export const useAsyncActionScope = () => {
  const active = useRef(new Set());
  const [count, setCount] = useState(0);
  const hasPending = useCallback(() => active.current.size > 0, []);
  const acquire = useCallback(() => {
    const token = {};
    active.current.add(token);
    setCount(active.current.size);
    return () => {
      active.current.delete(token);
      setCount(active.current.size);
    };
  }, []);
  return useMemo(() => ({ pending: count > 0, hasPending, acquire }), [count, hasPending, acquire]);
};
