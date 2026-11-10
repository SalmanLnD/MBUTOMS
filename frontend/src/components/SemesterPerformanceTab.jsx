import { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getSemesterPerformanceSummary } from '../services/plpService.js';
import { useAcademicTerm } from '../context/AcademicTermContext.jsx';
import { getErrorMessage } from '../utils/helpers.js';
import { showError } from '../utils/toast.js';
import { isAbortError } from '../services/api.js';

const score = (value) => value == null ? '—' : Number(value).toFixed(2);

const SemesterPerformanceTab = () => {
  const { viewedTerm } = useAcademicTerm() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setData(null);
    setError('');
    if (!viewedTerm?._id) { setLoading(false); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    getSemesterPerformanceSummary(viewedTerm._id, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((error) => { if (!controller.signal.aborted && !isAbortError(error)) { setError(getErrorMessage(error)); showError(getErrorMessage(error)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [viewedTerm?._id, retry]);

  if (loading) return <LoadingSpinner message="Loading semester performance…" />;
  if (error) return <div role="alert"><p>{error}</p><button type="button" className="btn btn-outline-primary" onClick={() => setRetry(value => value + 1)}>Retry semester analysis</button></div>;
  if (!data) return <p className="text-muted mb-0">No semester selected.</p>;
  return <div>
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div><h5 className="mb-1">Semester performance analysis</h5><p className="text-muted mb-0">{data.term.academicYear} · {data.term.parity} semester</p></div>
      <span className="badge text-bg-light">{data.rows.length} trainers</span>
    </div>
    <div className="table-responsive">
      <table className="table table-sm align-middle">
        <thead><tr><th>Trainer</th><th>Employee ID</th><th>RRD</th><th>Class observation avg / 5</th><th>Feedback avg / 5</th><th>Compliance</th></tr></thead>
        <tbody>{data.rows.map((row) => <tr key={row.trainerId}>
          <td>{row.name || '—'}</td><td>{row.employeeId || '—'}</td><td>{row.rrd}</td>
          <td>{score(row.classObservationAverage)}{row.classObservationCount ? <small className="text-muted ms-1">({row.classObservationCount})</small> : ''}</td>
          <td>{score(row.feedbackAverage)}{row.feedbackCount ? <small className="text-muted ms-1">({row.feedbackCount})</small> : ''}</td>
          <td>{row.complianceCount}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
};

export default SemesterPerformanceTab;
