import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getObservations, upsertObservation } from '../services/observationService.js';
import {
  buildMonthOptions,
  clampMonthParts,
  formatMonthKey,
  getCurrentMonthParts,
  shiftMonth,
} from '../utils/monthDates.js';
import { showError, showSuccess } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const OBSERVATION_SUB_TABS = [
  { id: 'demo', label: 'Demo' },
  { id: 'class', label: 'Class' },
];

const emptyDraft = (row) => ({
  rating: row.rating == null ? '' : String(row.rating),
  comments: row.comments || '',
  scheduleId: row.scheduleId || '',
});

const ObservationsTab = () => {
  const [observationType, setObservationType] = useState('demo');
  const [monthParts, setMonthParts] = useState(() => clampMonthParts(getCurrentMonthParts()));
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  const monthKey = formatMonthKey(monthParts.year, monthParts.month);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const isClass = observationType === 'class';

  const loadObservations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getObservations({ month: monthKey, type: observationType });
      const trainers = data.trainers || [];
      setRows(trainers);
      setDrafts(Object.fromEntries(
        trainers.map((row) => [row.trainerId, emptyDraft(row)])
      ));
    } catch (err) {
      showError(getErrorMessage(err));
      setRows([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, [monthKey, observationType]);

  useEffect(() => {
    loadObservations();
  }, [loadObservations]);

  const updateDraft = (trainerId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [trainerId]: {
        ...(prev[trainerId] || { rating: '', comments: '', scheduleId: '' }),
        [field]: value,
      },
    }));
  };

  const handleSave = async (row) => {
    const draft = drafts[row.trainerId] || emptyDraft(row);
    if (isClass && !draft.scheduleId) {
      showError('Select the class and slot for this observation');
      return;
    }

    setSavingId(row.trainerId);
    try {
      const saved = await upsertObservation(row.trainerId, {
        monthKey,
        type: observationType,
        rating: draft.rating === '' ? null : Number(draft.rating),
        comments: draft.comments,
        scheduleId: isClass ? draft.scheduleId || null : null,
      });
      setRows((prev) => prev.map((item) => (
        item.trainerId === row.trainerId
          ? {
            ...item,
            rating: saved.rating,
            comments: saved.comments,
            updatedAt: saved.updatedAt,
            scheduleId: saved.scheduleId,
            department: saved.department,
            section: saved.section,
            slot: saved.slot,
            startTime: saved.startTime,
            endTime: saved.endTime,
            day: saved.day,
            subjectCode: saved.subjectCode,
            classDetail: saved.classDetail,
          }
          : item
      )));
      setDrafts((prev) => ({
        ...prev,
        [row.trainerId]: emptyDraft({
          ...saved,
          scheduleOptions: row.scheduleOptions,
        }),
      }));
      showSuccess('Observation saved');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSavingId('');
    }
  };

  return (
    <>
      <ul className="nav nav-tabs mb-3" role="tablist">
        {OBSERVATION_SUB_TABS.map((tab) => (
          <li className="nav-item" key={tab.id} role="presentation">
            <button
              type="button"
              role="tab"
              className={`nav-link ${observationType === tab.id ? 'active' : ''}`}
              aria-selected={observationType === tab.id}
              onClick={() => setObservationType(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="row g-2 mb-3 align-items-center">
        <div className="col-auto">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setMonthParts((prev) => shiftMonth(prev, -1))}
          >
            Previous
          </button>
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={monthKey}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-').map(Number);
              setMonthParts(clampMonthParts({ year, month }));
            }}
            aria-label="Observation month"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="col-auto">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setMonthParts((prev) => shiftMonth(prev, 1))}
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Trainer</th>
                <th>Emp ID</th>
                {isClass && <th style={{ minWidth: 280 }}>Class / slot</th>}
                <th style={{ width: 120 }}>Rating (1–5)</th>
                <th>Comments</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={isClass ? 6 : 5} className="text-center text-muted py-4">
                    No trainers found
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const draft = drafts[row.trainerId] || emptyDraft(row);
                  const dirty = String(draft.rating) !== String(row.rating ?? '')
                    || String(draft.comments || '') !== String(row.comments || '')
                    || String(draft.scheduleId || '') !== String(row.scheduleId || '');
                  return (
                    <tr key={row.trainerId}>
                      <td className="fw-medium">{row.name}</td>
                      <td>{row.employeeId}</td>
                      {isClass && (
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={draft.scheduleId}
                            onChange={(e) => updateDraft(row.trainerId, 'scheduleId', e.target.value)}
                            aria-label={`Class and slot for ${row.name}`}
                          >
                            <option value="">Select class / slot</option>
                            {(row.scheduleOptions || []).map((option) => (
                              <option key={option.scheduleId} value={option.scheduleId}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={draft.rating}
                          onChange={(e) => updateDraft(row.trainerId, 'rating', e.target.value)}
                          aria-label={`Rating for ${row.name}`}
                        >
                          <option value="">—</option>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={draft.comments}
                          onChange={(e) => updateDraft(row.trainerId, 'comments', e.target.value)}
                          placeholder="Observation comments"
                          aria-label={`Comments for ${row.name}`}
                        />
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={!dirty || savingId === row.trainerId}
                          onClick={() => handleSave(row)}
                        >
                          {savingId === row.trainerId ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default ObservationsTab;
