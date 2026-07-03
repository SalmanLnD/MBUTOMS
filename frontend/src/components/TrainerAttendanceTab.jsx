import { useState, useEffect, useCallback, Fragment } from 'react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getTrainerAttendanceGrid,
  upsertTrainerDailyAttendance,
} from '../services/attendanceService.js';
import { getErrorMessage } from '../utils/helpers.js';
import {
  formatWeekLabel,
  getWeekRange,
  shiftWeek,
  toInputDate,
} from '../utils/weekDates.js';

const TrainerAttendanceTab = () => {
  const { user, hasRole } = useAuth();
  const canManageAll = hasRole('admin', 'campus_manager');

  const [weekRef, setWeekRef] = useState(new Date());
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');

  const fetchGrid = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getWeekRange(weekRef);
      const data = await getTrainerAttendanceGrid({
        startDate: toInputDate(startDate),
        endDate: toInputDate(endDate),
        semester: 'III',
      });
      setGrid(data);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [weekRef]);

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
          return {
            ...row,
            days: {
              ...row.days,
              [dateKey]: {
                ...row.days[dateKey],
                [field]: value,
              },
            },
          };
        }),
      };
    });
  };

  const handleSave = async (trainerId, dateKey) => {
    const row = grid?.rows.find((entry) => entry.trainer._id === trainerId);
    const cell = row?.days[dateKey];
    if (!cell) return;

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

  const { startDate: weekStart, endDate: weekEnd } = getWeekRange(weekRef);
  const weekLabel = formatWeekLabel(grid?.startDate || weekStart, grid?.endDate || weekEnd);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 className="mb-1">Trainer Attendance</h5>
          <p className="text-muted small mb-0">
            Class handling hours are calculated from the weekly timetable for each date.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setWeekRef(shiftWeek(weekRef, -1))}
          >
            Previous Week
          </button>
          <span className="fw-semibold small">{weekLabel}</span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setWeekRef(shiftWeek(weekRef, 1))}
          >
            Next Week
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setWeekRef(new Date())}
          >
            This Week
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading attendance grid..." />
      ) : !grid?.rows?.length ? (
        <div className="text-center text-muted py-5">No trainers found for attendance.</div>
      ) : (
        <div className="table-responsive trainer-attendance-grid">
          <table className="table table-bordered table-sm align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th rowSpan="2" className="trainer-attendance-sticky-col">Trainer</th>
                {grid.dates.map((date) => (
                  <th key={date.key} colSpan="3" className="text-center">
                    {date.label}
                  </th>
                ))}
              </tr>
              <tr>
                {grid.dates.map((date) => (
                  <Fragment key={`${date.key}-headers`}>
                    <th className="text-center small">OIF Number</th>
                    <th className="text-center small">Mock / Prep Hrs</th>
                    <th className="text-center small">Class Hrs</th>
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
                    const editable = canEditTrainer(row.trainer._id);
                    const saveKey = `${row.trainer._id}|${date.key}`;
                    const isSaving = savingKey === saveKey;

                    return (
                      <Fragment key={`${row.trainer._id}-${date.key}`}>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={cell.oifNumber}
                            disabled={!editable || isSaving}
                            onChange={(e) => updateCell(row.trainer._id, date.key, 'oifNumber', e.target.value)}
                            onBlur={() => editable && handleSave(row.trainer._id, date.key)}
                            placeholder="OIF"
                          />
                        </td>
                        <td>
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
                        <td className="text-center">
                          <span className="badge bg-light text-dark border">
                            {Number(cell.classHandlingHours || 0).toFixed(1)}
                          </span>
                        </td>
                      </Fragment>
                    );
                  })}
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
