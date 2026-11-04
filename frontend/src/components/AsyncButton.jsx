import { forwardRef, useContext } from 'react';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
import { AsyncFormContext } from '../context/AsyncActionScope.jsx';

/** Native button semantics, with immediate feedback for promise-returning actions. */
const AsyncButton = forwardRef(function AsyncButton({ onClick, disabled, children, type, ...props }, ref) {
  const { pending, scopePending, run } = useAsyncAction();
  const formPending = useContext(AsyncFormContext);
  const busy = pending || ((type === 'submit' || type == null) && (formPending || scopePending));
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || pending || formPending || scopePending}
      aria-busy={busy || props['aria-busy'] || undefined}
      onClick={event => run(event, onClick)}
    >
      {busy && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
      {children}
      {busy && <span className="visually-hidden" role="status">Processing, please wait</span>}
    </button>
  );
});

export default AsyncButton;
