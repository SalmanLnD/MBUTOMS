import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import StyledSelect from './StyledSelect.jsx';
import { getObservations, upsertObservation } from '../services/observationService.js';
import {
  buildMonthOptions,
  clampMonthParts,
  formatMonthKey,
  getCurrentMonthParts,
  shiftMonth,
} from '../utils/monthDates.js';
import { showError, showSuccess } from '../utils/toast.js';
import { getErrorMessage, toInputDate, toInputTime } from '../utils/helpers.js';

const OBSERVATION_SUB_TABS = [
  { id: 'demo', label: 'Demo' },
  { id: 'class', label: 'Class' },
];

// Ratings in 0.5 steps: 0.5, 1, 1.5 … 5.
const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

const emptyDraft = (row) => ({
  rating: row.rating == null ? '' : String(row.rating),
  comments: row.comments || '',
  scheduleId: row.scheduleId || '',
  observationDate: row.observationDate || '',
  observationTime: row.observationTime || '',
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
  const isDemo = observationType === 'demo';

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
    setDrafts((prev) => {
      const current = prev[trainerId] || {
        rating: '',
        comments: '',
        scheduleId: '',
        observationDate: '',
        observationTime: '',
      };
      const next = { ...current, [field]: value };
      const editingContent = field !== 'observationDate'
        && field !== 'observationTime'
        && String(value || '').trim();

      // Autofill today's date/time on first content edit, keep editable.
      if (editingContent) {
        const now = new Date();
        if (!String(current.observationDate || '').trim()) {
          next.observationDate = toInputDate(now);
        }
        if (isDemo && !String(current.observationTime || '').trim()) {
          next.observationTime = toInputTime(now);
        }
      }

      return { ...prev, [trainerId]: next };
    });
  };

  const handleSave = async (row) => {
    const draft = drafts[row.trainerId] || emptyDraft(row);
    if (isClass && !draft.scheduleId) {
      showError('Select the class and slot for this observation');
      return;
    }
    if ((draft.rating !== '' || String(draft.comments || '').trim()) && !draft.observationDate) {
      showError('Select the observation date');
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
        observationDate: draft.observationDate || '',
        observationTime: isDemo ? (draft.observationTime || '') : '',
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
            observationDate: saved.observationDate || '',
            observationTime: saved.observationTime || '',
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
          <StyledSelect
            value={monthKey}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-').map(Number);
              setMonthParts(clampMonthParts({ year, month }));
            }}
            aria-label="Observation month"
            options={monthOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
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
                <th style={{ width: 150 }}>Date</th>
                {isDemo && <th style={{ width: 130 }}>Time</th>}
                <th style={{ width: 120 }}>Rating (1–5)</th>
                <th>Comments</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    No trainers found
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const draft = drafts[row.trainerId] || emptyDraft(row);
                  const dirty = String(draft.rating) !== String(row.rating ?? '')
                    || String(draft.comments || '') !== String(row.comments || '')
                    || String(draft.scheduleId || '') !== String(row.scheduleId || '')
                    || String(draft.observationDate || '') !== String(row.observationDate || '')
                    || String(draft.observationTime || '') !== String(row.observationTime || '');
                  return (
                    <tr key={row.trainerId}>
                      <td className="fw-medium">{row.name}</td>
                      <td>{row.employeeId}</td>
                      {isClass && (
                        <td>
                          <StyledSelect
                            size="sm"
                            className="toms-styled-select--table-cell"
                            value={draft.scheduleId}
                            onChange={(e) => updateDraft(row.trainerId, 'scheduleId', e.target.value)}
                            aria-label={`Class and slot for ${row.name}`}
                            placeholder="Select class / slot"
                            options={(row.scheduleOptions || []).map((option) => ({
                              value: option.scheduleId,
                              label: option.label,
                            }))}
                          />
                        </td>
                      )}
                      <td>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={draft.observationDate}
                          onChange={(e) => updateDraft(row.trainerId, 'observationDate', e.target.value)}
                          aria-label={`Observation date for ${row.name}`}
                          required
                        />
                      </td>
                      {isDemo && (
                        <td>
                          <input
                            type="time"
                            className="form-control form-control-sm"
                            value={draft.observationTime}
                            onChange={(e) => updateDraft(row.trainerId, 'observationTime', e.target.value)}
                            aria-label={`Observation time for ${row.name}`}
                          />
                        </td>
                      )}
                      <td>
                        <StyledSelect
                          size="sm"
                          className="toms-styled-select--table-cell"
                          value={draft.rating}
                          onChange={(e) => updateDraft(row.trainerId, 'rating', e.target.value)}
                          aria-label={`Rating for ${row.name}`}
                          placeholder="—"
                          options={RATING_OPTIONS.map((rating) => ({
                            value: String(rating),
                            label: String(rating),
                          }))}
                        />
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
