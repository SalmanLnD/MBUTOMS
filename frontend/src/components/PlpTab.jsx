import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import PlpSheetSetupModal from './PlpSheetSetupModal.jsx';
import { ExternalLinkIcon, SheetIcon } from './icons.jsx';
import {
  getPlpSheet,
  getPlpSheetStatus,
  updatePlpWeightages,
  upsertPlpFinalRating,
} from '../services/plpService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { showError, showSuccess } from '../utils/toast.js';
import { isAbortError } from '../services/api.js';

const formatScore = (value) => (value == null || value === '' ? '—' : value);

const WEIGHTAGE_FIELDS = [
  { key: 'feedback', label: 'Feedback' },
  { key: 'classObservation', label: 'Class observation' },
  { key: 'demoObservation', label: 'Demo observation' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'compliance', label: 'Compliance' },
];

const FINAL_OPTIONS = [3.5, 4, 4.5];

const PlpTab = () => {
  const [cycleKey, setCycleKey] = useState('');
  const [cycles, setCycles] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState(null);
  const [weightDraft, setWeightDraft] = useState(null);
  const [finalDrafts, setFinalDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingWeights, setSavingWeights] = useState(false);
  const [savingFinalId, setSavingFinalId] = useState('');
  const [sheetStatus, setSheetStatus] = useState(null);
  const [showSheetSetup, setShowSheetSetup] = useState(false);

  const weightTotal = useMemo(() => {
    if (!weightDraft) return 0;
    return WEIGHTAGE_FIELDS.reduce(
      (sum, field) => sum + (Number(weightDraft[field.key]) || 0),
      0
    );
  }, [weightDraft]);

  const loadSheetStatus = useCallback(async () => {
    try {
      setSheetStatus(await getPlpSheetStatus());
    } catch {
      setSheetStatus(null);
    }
  }, []);

  const loadPlp = useCallback(async (signal, preferredCycle) => {
    setLoading(true);
    try {
      const data = await getPlpSheet(preferredCycle || cycleKey || undefined, { signal });
      const nextCycle = data.cycleKey;
      setCycleKey(nextCycle);
      setCycles(data.cycles || []);
      setCycle(data.cycle || null);
      setRows(data.rows || []);
      setHeaders(data.headers || null);
      setWeightDraft(data.weightages || null);
      setFinalDrafts(Object.fromEntries(
        (data.rows || []).map((row) => [
          row.trainerId,
          row.finalPlpRating == null ? '' : String(row.finalPlpRating),
        ])
      ));
    } catch (err) {
      if (isAbortError(err)) return;
      showError(getErrorMessage(err));
      setRows([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [cycleKey]);

  useEffect(() => {
    const controller = new AbortController();
    loadPlp(controller.signal);
    return () => controller.abort();
    // Initial + cycle changes handled via setCycleKey + explicit reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSheetStatus();
  }, [loadSheetStatus]);

  const handleCycleChange = async (nextCycle) => {
    setCycleKey(nextCycle);
    const controller = new AbortController();
    await loadPlp(controller.signal, nextCycle);
  };

  const handleSaveWeightages = async () => {
    if (!weightDraft) return;
    if (Math.abs(weightTotal - 100) > 0.01) {
      showError(`Weightages must total 100% (currently ${weightTotal}%).`);
      return;
    }
    setSavingWeights(true);
    try {
      const data = await updatePlpWeightages(weightDraft);
      setWeightDraft(data.weightages);
      setHeaders(data.headers);
      showSuccess('PLP weightages saved');
      await loadPlp(undefined, cycleKey);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSavingWeights(false);
    }
  };

  const handleSaveFinal = async (row) => {
    const raw = finalDrafts[row.trainerId];
    setSavingFinalId(row.trainerId);
    try {
      if (raw === '' || raw == null) {
        const data = await upsertPlpFinalRating(row.trainerId, {
          cycleKey,
          clear: true,
        });
        if (data.row) {
          setRows((prev) => prev.map((entry) => (
            entry.trainerId === row.trainerId ? data.row : entry
          )));
          setFinalDrafts((prev) => ({
            ...prev,
            [row.trainerId]: data.row.finalPlpRating == null
              ? ''
              : String(data.row.finalPlpRating),
          }));
        } else {
          await loadPlp(undefined, cycleKey);
        }
        showSuccess('Manual final cleared — using calculated value');
      } else {
        const data = await upsertPlpFinalRating(row.trainerId, {
          cycleKey,
          finalRating: Number(raw),
        });
        setRows((prev) => prev.map((entry) => (
          entry.trainerId === row.trainerId
            ? {
              ...entry,
              manualFinal: data.finalRating,
              isManualFinal: true,
              finalPlpRating: data.finalRating,
            }
            : entry
        )));
        setFinalDrafts((prev) => ({
          ...prev,
          [row.trainerId]: String(data.finalRating),
        }));
        showSuccess('Final PLP rating saved');
      }
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSavingFinalId('');
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <ul className="nav nav-tabs mb-0 flex-wrap" role="tablist">
          {cycles.map((option) => (
            <li className="nav-item" key={option.value} role="presentation">
              <button
                type="button"
                role="tab"
                className={`nav-link ${cycleKey === option.value ? 'active' : ''}`}
                aria-selected={cycleKey === option.value}
                onClick={() => handleCycleChange(option.value)}
              >
                {option.shortLabel || option.label}
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

      {cycle && (
        <p className="text-muted small mb-3">
          Cycle <strong>{cycle.label}</strong>. Class and demo observations, attendance RRD, and
          compliance all count from the 21st to the 20th. Feedback alone uses calendar month{' '}
          <strong>{cycle.feedbackMonthKey}</strong> (e.g. July feedback for the Jun–Jul cycle).
          Final rating is rounded to 0.5 and clamped between 3.5 and 4.5; you can override it
          manually.
        </p>
      )}

      {weightDraft && (
        <div className="border rounded p-3 mb-3 bg-light">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <strong>Weightages (%)</strong>
            <span className={`small ${Math.abs(weightTotal - 100) < 0.01 ? 'text-success' : 'text-danger'}`}>
              Total: {weightTotal}%
            </span>
          </div>
          <div className="row g-2 align-items-end">
            {WEIGHTAGE_FIELDS.map((field) => (
              <div className="col-6 col-md" key={field.key}>
                <label className="form-label small mb-1" htmlFor={`plp-weight-${field.key}`}>
                  {field.label}
                </label>
                <input
                  id={`plp-weight-${field.key}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="form-control form-control-sm"
                  value={weightDraft[field.key] ?? ''}
                  onChange={(e) => setWeightDraft((prev) => ({
                    ...prev,
                    [field.key]: e.target.value === '' ? '' : Number(e.target.value),
                  }))}
                />
              </div>
            ))}
            <div className="col-12 col-md-auto">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingWeights || Math.abs(weightTotal - 100) > 0.01}
                onClick={handleSaveWeightages}
              >
                {savingWeights ? 'Saving...' : 'Save weightages'}
              </button>
            </div>
          </div>
        </div>
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
                <th style={{ minWidth: 160 }}>{headers?.finalRating || 'Final PLP rating'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    No trainers found for this cycle.
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
                    <div className="d-flex flex-wrap align-items-center gap-1">
                      <select
                        className="form-select form-select-sm"
                        style={{ maxWidth: 90 }}
                        value={finalDrafts[row.trainerId] ?? ''}
                        aria-label={`Final PLP for ${row.name}`}
                        onChange={(e) => setFinalDrafts((prev) => ({
                          ...prev,
                          [row.trainerId]: e.target.value,
                        }))}
                      >
                        <option value="">
                          Calc {row.calculatedFinal == null ? '—' : row.calculatedFinal}
                        </option>
                        {FINAL_OPTIONS.map((value) => (
                          <option key={value} value={String(value)}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        disabled={savingFinalId === row.trainerId}
                        onClick={() => handleSaveFinal(row)}
                      >
                        {savingFinalId === row.trainerId ? '...' : 'Save'}
                      </button>
                    </div>
                    {row.isManualFinal && (
                      <div className="text-muted small mt-1">
                        Manual (calc {formatScore(row.calculatedFinal)})
                      </div>
                    )}
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
