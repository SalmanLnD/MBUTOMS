import { useState } from 'react';
import api from '../services/api.js';
import Modal from './Modal.jsx';
import AsyncButton from './AsyncButton.jsx';
import { useAcademicTerm } from '../context/AcademicTermContext.jsx';
import { safeCalendarUrl, termLabel } from '../utils/academicTerm.js';

const blank = { academicYear: '', parity: 'odd', startDate: '', endDate: '', calendarUrl: '', programDurations: {} };
const dateInput = (date) => date ? String(date).slice(0, 10) : '';

const AcademicTermManager = ({ onClose }) => {
  const academic = useAcademicTerm();
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank);
  const [durationText, setDurationText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const act = async (action) => {
    setError(''); setNotice(''); setBusy(true);
    try { await action(); } catch (err) { setError(err.response?.data?.message || err.message || 'Unable to update semester.'); }
    finally { setBusy(false); }
  };
  const openForm = (term) => {
    setEdit(term?._id || 'new');
    setForm(term ? { ...term, startDate: dateInput(term.startDate), endDate: dateInput(term.endDate) } : { ...blank, academicYear: academic.currentTerm?.academicYear || '2026-2027' });
    setDurationText(Object.entries(term?.programDurations || {}).map(([department, semesters]) => `${department}=${semesters}`).join('\n'));
    setError(''); setNotice(''); setPreview(null); setPublishing(null);
  };
  const save = async (event) => {
    event.preventDefault();
    await act(async () => {
      if (form.calendarUrl && !safeCalendarUrl(form.calendarUrl)) throw new Error('Enter a valid https calendar link.');
      const programDurations = {};
      for (const line of durationText.split(/\r?\n/).filter((value) => value.trim())) {
        const [department, value, extra] = line.split('=');
        if (!department?.trim() || extra != null || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 12) throw new Error('Use one department and duration (1–12 semesters) per line, for example CSE=8.');
        if (programDurations[department.trim()] != null) throw new Error(`Duplicate department: ${department.trim()}`);
        programDurations[department.trim()] = Number(value);
      }
      const payload = { academicYear: form.academicYear, parity: form.parity, startDate: form.startDate, endDate: form.endDate, calendarUrl: form.calendarUrl || '', programDurations };
      if (edit === 'new') await api.post('/academic-terms', payload);
      else await api.patch(`/academic-terms/${edit}`, payload);
      setEdit(null);
      await academic.refresh();
      setNotice('Semester settings saved.');
    });
  };
  const loadPreview = (term) => act(async () => {
    const { data } = await api.get(`/academic-terms/${term._id}/preview`);
    setPreview({ term, data }); setPublishing(null); setEdit(null);
  });
  const prepare = (term, reconcile = false) => act(async () => {
    const { data } = await api.post(`/academic-terms/${term._id}/prepare`, { expectedRevision: academic.revision, reconcile });
    await academic.refresh();
    setPreview({ term, data: data.preparation || data.preview || data.summary || data });
    setNotice('Target semester prepared. Review the promotion summary before publication.');
  });
  const publish = () => act(async () => {
    if (!confirmed || !publishing) return;
    await api.post(`/academic-terms/${publishing._id}/publish`, { expectedRevision: academic.revision });
    setPublishing(null); setConfirmed(false); setPreview(null);
    await academic.refresh();
    setNotice('Current semester published for all trainers.');
  });

  return <Modal show title="Academic years & semesters" onClose={onClose} size="modal-xl" scrollable closeDisabled={busy}>
    <div className="toms-modal-body" data-academic-controls>
      <p>Published current: <strong>{termLabel(academic.currentTerm)}</strong>. Viewing a semester is personal. Publishing changes the semester for all trainers.</p>
      {!academic.enabled && <div className="alert alert-info">Semester isolation is awaiting the verified database migration. Management actions become available after migration is enabled.</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      <div className="table-responsive"><table className="table align-middle">
        <thead><tr><th scope="col">Academic year</th><th scope="col">Semester</th><th scope="col">Status</th><th scope="col">Calendar</th><th scope="col">Actions</th></tr></thead>
        <tbody>{(academic.terms || []).map((term) => <tr key={term._id}>
          <td>{term.academicYear}</td><td>{term.parity === 'even' ? 'Even' : 'Odd'}</td>
          <td>{term._id === academic.currentTerm?._id ? <strong>Current</strong> : term.lifecycle}{term.preparation && <span className="d-block small text-muted">Prepared</span>}</td>
          <td>{safeCalendarUrl(term.calendarUrl) ? <a href={safeCalendarUrl(term.calendarUrl)} target="_blank" rel="noopener noreferrer">Open calendar</a> : <span className="text-muted">Not configured</span>}</td>
          <td><div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!academic.enabled || busy} onClick={() => { academic.selectTerm(term._id === academic.currentTerm?._id ? '' : String(term._id)); onClose(); }}>View</button>
            <button type="button" className="btn btn-sm btn-outline-primary" disabled={!academic.enabled || busy || term.lifecycle === 'archived'} onClick={() => openForm(term)}>Settings</button>
            {term.lifecycle === 'draft' && <>
              <AsyncButton type="button" className="btn btn-sm btn-outline-primary" disabled={!academic.enabled || busy} onClick={() => loadPreview(term)}>Preview promotion</AsyncButton>
              <button type="button" className="btn btn-sm btn-primary" disabled={!academic.enabled || busy || !term.preparation} onClick={() => { setPublishing(term); setConfirmed(false); setEdit(null); }}>Publish as current</button>
            </>}
          </div></td>
        </tr>)}</tbody>
      </table></div>
      <button type="button" className="btn btn-outline-primary" disabled={!academic.enabled || busy} onClick={() => openForm(null)}>Add semester / academic year</button>
      {edit && <form className="border rounded p-3 mt-3" onSubmit={save}>
        <h6>{edit === 'new' ? 'Create semester' : 'Semester settings'}</h6>
        <fieldset disabled={busy}>
          <div className="row g-3">
            <div className="col-sm-6"><label htmlFor="term-year" className="form-label">Academic year</label><input id="term-year" className="form-control" value={form.academicYear} required pattern="[0-9]{4}-[0-9]{4}" placeholder="2026-2027" disabled={edit !== 'new'} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></div>
            <div className="col-sm-6"><label htmlFor="term-parity" className="form-label">Semester</label><select id="term-parity" className="form-select" value={form.parity} disabled={edit !== 'new'} onChange={(e) => setForm({ ...form, parity: e.target.value })}><option value="odd">Odd</option><option value="even">Even</option></select></div>
            <div className="col-sm-6"><label htmlFor="term-start" className="form-label">Start date</label><input id="term-start" className="form-control" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="col-sm-6"><label htmlFor="term-end" className="form-label">End date</label><input id="term-end" className="form-control" type="date" required min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div className="col-12"><label htmlFor="term-calendar" className="form-label">Academic calendar link</label><input id="term-calendar" className="form-control" type="url" value={form.calendarUrl || ''} onChange={(e) => setForm({ ...form, calendarUrl: e.target.value })} /></div>
            <div className="col-12"><label htmlFor="term-durations" className="form-label">Program duration by department</label><textarea id="term-durations" className="form-control" rows={4} aria-describedby="term-duration-help" value={durationText} onChange={(e) => setDurationText(e.target.value)} /><div id="term-duration-help" className="form-text">Number of semesters, one department per line: CSE=8 or BCA=6. Required for safe promotion and graduation.</div></div>
          </div>
          <div className="d-flex gap-2 mt-3"><AsyncButton type="submit" className="btn btn-primary">Save settings</AsyncButton><button type="button" className="btn btn-outline-secondary" onClick={() => setEdit(null)}>Cancel</button></div>
        </fieldset>
      </form>}
      {preview && <section className="border rounded p-3 mt-3" aria-labelledby="term-promotion-title">
        <h6 id="term-promotion-title">Promotion preview · {termLabel(preview.term)}</h6>
        <p>Source records and marks remain in their original semester. Preparing creates the next roster; publication activates it.</p>
        <dl className="row mb-2">
          <dt className="col-sm-6">Students advancing one semester</dt><dd className="col-sm-6">{preview.data.promote ?? 0}</dd>
          <dt className="col-sm-6">Students completing their program</dt><dd className="col-sm-6">{preview.data.graduate ?? 0}</dd>
          <dt className="col-sm-6">Inactive or ineligible students skipped</dt><dd className="col-sm-6">{preview.data.skipped ?? 0}</dd>
        </dl>
        {preview.data.errors?.length > 0 && <div className="alert alert-warning"><strong>Resolve these items before preparing:</strong><ul className="mb-0">{preview.data.errors.map((message, index) => <li key={index}>{message}</li>)}</ul></div>}
        <AsyncButton type="button" className="btn btn-primary" disabled={busy || Boolean(preview.data.errors?.length)} onClick={() => prepare(preview.term)}>Prepare next semester</AsyncButton>
        {preview.term.preparation && <AsyncButton type="button" className="btn btn-outline-primary ms-2" disabled={busy || Boolean(preview.data.errors?.length)} onClick={() => prepare(preview.term, true)}>Reconcile prepared roster</AsyncButton>}
      </section>}
      {publishing && <section className="border border-warning rounded p-3 mt-3" aria-labelledby="term-publish-title">
        <h6 id="term-publish-title">Publish {termLabel(publishing)} as current?</h6>
        <p>All trainers will load this semester. Students use the promoted roster, and the previous semester remains available to admins as read-only history.</p>
        <div className="form-check mb-3"><input id="term-confirm-publish" type="checkbox" className="form-check-input" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} /><label className="form-check-label" htmlFor="term-confirm-publish">I reviewed the roster, dates, calendar and program completion rules.</label></div>
        <div className="d-flex gap-2"><AsyncButton type="button" className="btn btn-warning" disabled={!confirmed || busy} onClick={publish}>Publish as current for everyone</AsyncButton><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setPublishing(null)}>Cancel</button></div>
      </section>}
    </div>
  </Modal>;
};

export default AcademicTermManager;
