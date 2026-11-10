import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAcademicTerm } from '../context/AcademicTermContext.jsx';
import { isAcademicPage, termLabel } from '../utils/academicTerm.js';
import AcademicTermManager from './AcademicTermManager.jsx';
import Modal from './Modal.jsx';

const AcademicTermControls = () => {
  const academic = useAcademicTerm();
  const { pathname } = useLocation();
  const [managing, setManaging] = useState(false);
  if (!academic) return null;
  const { enabled, isAdmin, terms = [], currentTerm, viewedTerm, selectedId, selectTerm, pending, error } = academic;
  const academicPage = isAcademicPage(pathname);
  const years = [...new Set(terms.map((term) => term.academicYear))].sort().reverse();
  const selectedYear = viewedTerm?.academicYear || years[0] || '';
  const yearTerms = terms.filter((term) => term.academicYear === selectedYear);

  return <div data-academic-controls>
    {error && <div className="alert alert-warning d-flex gap-2 align-items-center" role="alert">
      <span>{error}</span><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => academic.refresh().catch(() => {})}>Retry</button>
    </div>}
    {pending && <Modal show title="The current semester changed" dismissible={false}>
      <div className="toms-modal-body" data-academic-controls role="alert">
      <strong>The published semester changed to {termLabel(pending.currentTerm)}.</strong>
      <p className="mb-2">Your open inputs are still here. Saving is paused. Download your inputs before loading the updated semester.</p>
      <div className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={academic.downloadEdits}>Download open inputs</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={academic.acceptPublication}>Load updated semester</button>
      </div>
      </div>
    </Modal>}
    {isAdmin && <div className="academic-term-toolbar mb-3 p-3 rounded border d-flex flex-wrap align-items-end gap-3">
      {enabled && academicPage && <>
        <div><label className="form-label small mb-1" htmlFor="academic-view-year">Viewing academic year</label>
          <select id="academic-view-year" className="form-select form-select-sm" value={selectedYear} onChange={(event) => selectTerm(String(terms.find((term) => term.academicYear === event.target.value)?._id || ''))}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div><label className="form-label small mb-1" htmlFor="academic-view-semester">Semester</label>
          <select id="academic-view-semester" className="form-select form-select-sm" value={String(viewedTerm?._id || '')} onChange={(event) => selectTerm(event.target.value === String(currentTerm?._id) ? '' : event.target.value)}>
            {yearTerms.map((term) => <option key={term._id} value={term._id}>{term.parity === 'even' ? 'Even' : 'Odd'}{term._id === currentTerm?._id ? ' · current' : ` · ${term.lifecycle}`}</option>)}
          </select>
        </div>
        <div className="small me-auto pb-1">Published current: <strong>{termLabel(currentTerm)}</strong></div>
        {selectedId && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => selectTerm('')}>Return to current semester</button>}
      </>}
      {enabled && !academicPage && <span className="small text-muted me-auto">Shared operations · all semesters</span>}
      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setManaging(true)}>Manage academic years & semesters</button>
    </div>}
    {enabled && isAdmin && academicPage && viewedTerm && viewedTerm._id !== currentTerm?._id && <div className="alert alert-info py-2" role="status">
      Viewing {termLabel(viewedTerm)} · {viewedTerm.lifecycle === 'archived' ? 'Archived semester · read only' : 'Draft · visible only to admins'}. This selection affects only your view.
    </div>}
    {managing && <AcademicTermManager onClose={() => setManaging(false)} />}
  </div>;
};

export default AcademicTermControls;
