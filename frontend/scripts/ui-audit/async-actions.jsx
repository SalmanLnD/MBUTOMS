// Development-only browser fixture; not included in the production build.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContainer } from 'react-toastify';
import AsyncButton from '../../src/components/AsyncButton.jsx';
import AsyncForm from '../../src/components/AsyncForm.jsx';
import Modal from '../../src/components/Modal.jsx';
import ConfirmModal from '../../src/components/ConfirmModal.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/styles/modal.css';

const root = createRoot(document.getElementById('root'));
const counters = {};
const gates = {};
const wait = key => {
  counters[key] = (counters[key] || 0) + 1;
  return new Promise((resolve, reject) => { gates[key] = { resolve, reject }; });
};
function Harness({ mode }) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('Keep this draft');
  const button = useRef(null);
  const submit = async event => {
    event.preventDefault();
    await wait('submit');
    setOpen(false);
  };
  const form = <AsyncForm id="audit-form" onSubmit={submit}>
    <div className="toms-modal-body">
      <label>Draft<input required value={draft} onChange={event => setDraft(event.target.value)} /></label>
    </div>
    {mode !== 'external' && <div className="toms-modal-footer"><AsyncButton type="button" onClick={() => setOpen(false)}>Cancel</AsyncButton><AsyncButton type="submit">Submit</AsyncButton></div>}
  </AsyncForm>;
  if (mode === 'button') return <>
    <AsyncButton ref={button} type="button" onClick={() => wait('one')}>Action one</AsyncButton>
    <AsyncButton type="button" onClick={() => wait('two')}>Action two</AsyncButton>
    <AsyncButton type="button" onClick={() => button.current.focus()}>Focus first</AsyncButton>
    <ToastContainer />
  </>;
  if (mode === 'confirm') return <><ConfirmModal show={open} title="Confirm action" onClose={() => setOpen(false)} onConfirm={async () => { await wait('confirm'); setOpen(false); }} /><ToastContainer /></>;
  return <><Modal show={open} title="Save draft" onClose={() => setOpen(false)} footer={mode === 'external' && <AsyncButton type="submit" form="audit-form">Submit externally</AsyncButton>}>{form}</Modal><ToastContainer /></>;
}
let renderKey = 0;
window.pendingAudit = {
  counters,
  mount(mode) { Object.keys(counters).forEach(key => delete counters[key]); root.render(<Harness key={++renderKey} mode={mode} />); },
  finish(key, fail = false) { gates[key][fail ? 'reject' : 'resolve'](fail ? new Error('Synthetic save failure') : undefined); },
};
