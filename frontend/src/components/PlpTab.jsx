import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import PlpSheetSetupModal from './PlpSheetSetupModal.jsx';
import { ExternalLinkIcon, SheetIcon } from './icons.jsx';
import { getPlpSheet, getPlpSheetStatus } from '../services/plpService.js';
import {
  buildMonthOptions,
  clampMonthParts,
  formatMonthKey,
  getCurrentMonthParts,
} from '../utils/monthDates.js';
import { getErrorMessage } from '../utils/helpers.js';
import { showError } from '../utils/toast.js';
import { isAbortError } from '../services/api.js';

const formatScore = (value) => (value == null || value === '' ? '—' : value);

const PlpTab = () => {
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [monthKey, setMonthKey] = useState(() => {
    const parts = clampMonthParts(getCurrentMonthParts());
    return formatMonthKey(parts.year, parts.month);
  });
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState(null);
  const [weightages, setWeightages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [showSheetSetup, setShowSheetSetup] = useState(false);

  const loadSheetStatus = useCallback(async () => {
    try {
      setSheetStatus(await getPlpSheetStatus());
    } catch {
      setSheetStatus(null);
    }
  }, []);

  const loadPlp = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await getPlpSheet(monthKey, { signal });
      setRows(data.rows || []);
      setHeaders(data.headers || null);
      setWeightages(data.weightages || null);
    } catch (err) {
      if (isAbortError(err)) return;
      showError(getErrorMessage(err));
      setRows([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    const controller = new AbortController();
    loadPlp(controller.signal);
    return () => controller.abort();
  }, [loadPlp]);

  useEffect(() => {
    loadSheetStatus();
  }, [loadSheetStatus]);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <ul className="nav nav-tabs mb-0 flex-wrap" role="tablist">
          {monthOptions.map((option) => (
            <li className="nav-item" key={option.value} role="presentation">
              <button
                type="button"
                role="tab"
                className={`nav-link ${monthKey === option.value ? 'active' : ''}`}
                aria-selected={monthKey === option.value}
                onClick={() => setMonthKey(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="d-flex flex-wrap gap-2">
          {sheetStatus?.spreadsheetUrl && (
            <a
              href={sheetStatus.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
            >
              <ExternalLinkIcon size={16} />
              Open linked sheet
            </a>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
            onClick={() => setShowSheetSetup(true)}
          >
            <SheetIcon size={16} />
            Link Google Sheet
          </button>
        </div>
      </div>

      {weightages && (
        <p className="text-muted small mb-3">
          Attendance defaults to 4 (−1 per RRD day). Compliance defaults to 5 (−1 per compliance
          record in the month). Final rating uses the header weightages; blank feedback/observation
          scores are excluded and remaining weights are renormalized.
        </p>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee ID</th>
                <th>Trainer</th>
                <th>{headers?.feedback || 'Feedback'}</th>
                <th>{headers?.classObservation || 'Class observation'}</th>
                <th>{headers?.demoObservation || 'Demo observation'}</th>
                <th>{headers?.attendance || 'Attendance'}</th>
                <th>{headers?.compliance || 'Compliance'}</th>
                <th>{headers?.finalRating || 'Final PLP rating'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    No trainers found for this month.
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.trainerId}>
                  <td>{row.employeeId || '—'}</td>
                  <td>{row.name}</td>
                  <td>{formatScore(row.feedbackRating)}</td>
                  <td>{formatScore(row.classObservationRating)}</td>
                  <td>{formatScore(row.demoObservationRating)}</td>
                  <td>
                    {formatScore(row.attendanceScore)}
                    {row.replacementRequiredDays > 0 && (
                      <span className="text-muted small ms-1">
                        ({row.replacementRequiredDays} RRD)
                      </span>
                    )}
                  </td>
                  <td>
                    {formatScore(row.complianceScore)}
                    {row.complianceCount > 0 && (
                      <span className="text-muted small ms-1">
                        ({row.complianceCount})
                      </span>
                    )}
                  </td>
                  <td>
                    <strong>{formatScore(row.finalPlpRating)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showSheetSetup && (
        <PlpSheetSetupModal
          show
          initialUrl={sheetStatus?.spreadsheetUrl || ''}
          onClose={() => setShowSheetSetup(false)}
          onLinked={() => {
            setShowSheetSetup(false);
            loadSheetStatus();
          }}
        />
      )}
    </>
  );
};

export default PlpTab;
