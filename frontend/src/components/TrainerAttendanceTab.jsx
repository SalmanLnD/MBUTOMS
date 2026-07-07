import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getTrainerAttendanceGrid,
  upsertTrainerDailyAttendance,
} from '../services/attendanceService.js';
import { getErrorMessage } from '../utils/helpers.js';
import {
  buildMonthOptions,
  clampMonthParts,
  formatMonthKey,
  formatMonthLabel,
  getCurrentMonthParts,
  isFutureDateKey,
  parseMonthKey,
  shiftMonth,
  TRAINER_ATTENDANCE_TRACKING_START,
} from '../utils/monthDates.js';

const TrainerAttendanceTab = () => {
  const { user, hasRole } = useAuth();
  const canManageAll = hasRole('admin', 'campus_manager');

  const [monthParts, setMonthParts] = useState(() =>
    clampMonthParts(getCurrentMonthParts())
  );
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');

  const monthKey = formatMonthKey(monthParts.year, monthParts.month);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const currentMonth = useMemo(() => getCurrentMonthParts(), []);
  const trackingMonth = parseMonthKey(TRAINER_ATTENDANCE_TRACKING_START.slice(0, 7));

  const atEarliestMonth =
    monthParts.year === trackingMonth.year && monthParts.month === trackingMonth.month;
  const atLatestMonth =
    monthParts.year === currentMonth.year && monthParts.month === currentMonth.month;

  const fetchGrid = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrainerAttendanceGrid({
        month: monthKey,
        semester: 'III',
      });
      setGrid(data);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    fetchGrid();
  }, [fetchGrid]);

  const canEditTrainer = (trainerId) =>
    canManageAll || user?.trainer?.toString() === trainerId?.toString();

  const updateCell = (trainerId, dateKey, field, value) => {
    setGrid((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) => {
          if (row.trainer._id !== trainerId) return row;
          const nextDays = {
            ...row.days,
            [dateKey]: {
              ...row.days[dateKey],
              [field]: value,
            },
          };
          const dateKeys = prev.dates.map((date) => date.key);
          const totals = dateKeys.reduce(
            (acc, key) => {
              const cell = nextDays[key];
              if (!cell) return acc;
              return {
                mockPrepHours: acc.mockPrepHours + Number(cell.mockPrepHours || 0),
                classHandlingHours: acc.classHandlingHours + Number(cell.classHandlingHours || 0),
                oifDays: acc.oifDays + (String(cell.oifNumber || '').trim() ? 1 : 0),
                workingDays: acc.workingDays,
              };
            },
            {
              mockPrepHours: 0,
              classHandlingHours: 0,
              oifDays: 0,
              workingDays: dateKeys.length,
            }
          );
          return { ...row, days: nextDays, totals };
        }),
      };
    });
  };

  const handleSave = async (trainerId, dateKey) => {
    const row = grid?.rows.find((entry) => entry.trainer._id === trainerId);
    const cell = row?.days[dateKey];
    if (!cell || cell.isFuture || isFutureDateKey(dateKey)) return;

    const saveKey = `${trainerId}|${dateKey}`;
    setSavingKey(saveKey);

    try {
      const saved = await upsertTrainerDailyAttendance({
        trainer: trainerId,
        date: dateKey,
        oifNumber: cell.oifNumber,
        mockPrepHours: cell.mockPrepHours,
      });

      setGrid((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((entry) => {
            if (entry.trainer._id !== trainerId) return entry;
            return {
              ...entry,
              days: {
                ...entry.days,
                [dateKey]: {
                  ...entry.days[dateKey],
                  id: saved.id,
                  classHandlingHours: saved.classHandlingHours,
                },
              },
            };
          }),
        };
      });
      showSuccess('Attendance saved');
    } catch (err) {
      showError(getErrorMessage(err));
      fetchGrid();
    } finally {
      setSavingKey('');
    }
  };

  const monthLabel = grid?.monthLabel || formatMonthLabel(monthParts.year, monthParts.month);

  return (
    <>
      <div className="trainer-attendance-toolbar mb-3">
        <h5 className="mb-0">Monthly Trainer Attendance</h5>

        <div className="trainer-attendance-month-controls">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={atEarliestMonth}
            onClick={() => setMonthParts((current) => shiftMonth(current, -1))}
          >
            Previous Month
          </button>
          <select
            className="form-select form-select-sm trainer-attendance-month-select"
            value={monthKey}
            onChange={(e) => setMonthParts(parseMonthKey(e.target.value))}
            aria-label="Select month"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={atLatestMonth}
            onClick={() => setMonthParts((current) => shiftMonth(current, 1))}
          >
            Next Month
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setMonthParts(clampMonthParts(getCurrentMonthParts()))}
          >
            This Month
          </button>
        </div>
      </div>

      {!loading && grid && (
        <div className="trainer-attendance-summary mb-3">
          <span className="trainer-attendance-pill">{monthLabel}</span>
          <span className="trainer-attendance-pill">
            {grid.workingDays} day{grid.workingDays === 1 ? '' : 's'} in month
          </span>
          {grid.editableDays !== undefined && grid.editableDays < grid.workingDays && (
            <span className="trainer-attendance-pill">
              {grid.editableDays} open for entry
            </span>
          )}
          <span className="trainer-attendance-pill">
            {grid.rows.length} trainer{grid.rows.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading monthly attendance..." />
      ) : !grid?.rows?.length ? (
        <div className="text-center text-muted py-5">No trainers found for attendance.</div>
      ) : !grid.dates.length ? (
        <div className="text-center text-muted py-5">
          No working days to show for {monthLabel}.
        </div>
      ) : (
        <div className="trainer-attendance-grid">
          <table className="table table-bordered table-sm align-middle mb-0 trainer-attendance-month-table">
            <thead className="table-light">
              <tr>
                <th rowSpan="2" className="trainer-attendance-sticky-col">Trainer</th>
                {grid.dates.map((date) => (
                  <th
                    key={`${date.key}-headers`}
                    className={`text-center small trainer-attendance-day-header ${
                      date.isFuture ? 'trainer-attendance-future' : ''
                    } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    colSpan="3"
                    title={date.key}
                  >
                    {date.label}
                  </th>
                ))}
                <th rowSpan="2" className="trainer-attendance-totals-col text-center">
                  Month Total
                </th>
              </tr>
              <tr>
                {grid.dates.map((date) => (
                  <Fragment key={`${date.key}-subheaders`}>
                    <th
                      className={`text-center small trainer-attendance-subheader ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      OIF
                    </th>
                    <th
                      className={`text-center small trainer-attendance-subheader ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      Mock
                    </th>
                    <th
                      className={`text-center small trainer-attendance-subheader ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      Class
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.trainer._id}>
                  <th scope="row" className="trainer-attendance-sticky-col">
                    <div className="fw-semibold">{row.trainer.name}</div>
                    <small className="text-muted">{row.trainer.employeeId}</small>
                  </th>
                  {grid.dates.map((date) => {
                    const cell = row.days[date.key] || {
                      oifNumber: '',
                      mockPrepHours: 0,
                      classHandlingHours: 0,
                    };
                    const editable = canEditTrainer(row.trainer._id) && !date.isFuture;
                    const saveKey = `${row.trainer._id}|${date.key}`;
                    const isSaving = savingKey === saveKey;
                    const futureClass = date.isFuture ? 'trainer-attendance-future' : '';
                    const weekendClass = date.isWeekend ? 'trainer-attendance-weekend' : '';
                    const cellClass = [futureClass, weekendClass].filter(Boolean).join(' ');

                    return (
                      <Fragment key={`${row.trainer._id}-${date.key}`}>
                        <td className={cellClass}>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={cell.oifNumber}
                            disabled={!editable || isSaving}
                            onChange={(e) => updateCell(row.trainer._id, date.key, 'oifNumber', e.target.value)}
                            onBlur={() => editable && handleSave(row.trainer._id, date.key)}
                            placeholder="—"
                          />
                        </td>
                        <td className={cellClass}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className="form-control form-control-sm"
                            value={cell.mockPrepHours}
                            disabled={!editable || isSaving}
                            onChange={(e) => updateCell(row.trainer._id, date.key, 'mockPrepHours', e.target.value)}
                            onBlur={() => editable && handleSave(row.trainer._id, date.key)}
                          />
                        </td>
                        <td className={`text-center ${cellClass}`}>
                          <span className="badge bg-light text-dark border">
                            {Number(cell.classHandlingHours || 0).toFixed(1)}
                          </span>
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className="trainer-attendance-totals-col">
                    <div className="trainer-attendance-totals-cell">
                      <div>
                        <span className="text-muted">Mock</span>
                        <strong>{Number(row.totals?.mockPrepHours || 0).toFixed(1)}</strong>
                      </div>
                      <div>
                        <span className="text-muted">Class</span>
                        <strong>{Number(row.totals?.classHandlingHours || 0).toFixed(1)}</strong>
                      </div>
                      <div>
                        <span className="text-muted">OIF days</span>
                        <strong>{row.totals?.oifDays || 0}</strong>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default TrainerAttendanceTab;
