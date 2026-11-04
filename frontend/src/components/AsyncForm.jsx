import { forwardRef } from 'react';
import { AsyncFormContext } from '../context/AsyncActionScope.jsx';
import { useAsyncAction } from '../hooks/useAsyncAction.js';

/** Prevent duplicate click/Enter submissions, including externally associated buttons. */
const AsyncForm = forwardRef(function AsyncForm({ onSubmit, children, ...props }, ref) {
  const { pending, scopePending, run } = useAsyncAction();
  return (
    <form {...props} ref={ref} aria-busy={pending || undefined} onSubmit={event => run(event, onSubmit)}>
      <AsyncFormContext.Provider value={pending}>
        <fieldset disabled={pending || scopePending} style={{ display: 'contents' }}>
          {children}
        </fieldset>
        {pending && <div className="small text-muted px-3 py-2" role="status">Processing, please wait…</div>}
      </AsyncFormContext.Provider>
    </form>
  );
});

export default AsyncForm;
