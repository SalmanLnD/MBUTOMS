import { useState, useEffect, useLayoutEffect, useCallback, Fragment, useMemo, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import TrainerAttendanceRow from '../components/TrainerAttendanceRow.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getTrainerAttendanceGrid,
  getTrainerAttendanceSheetStatus,
  upsertTrainerDailyAttendance,
  invalidateTrainerAttendanceGridCache,
} from '../services/attendanceService.js';
import { getErrorMessage } from '../utils/helpers.js';
import {
  buildMonthOptions,
  clampMonthParts,
  formatMonthKey,
  formatMonthLabel,
  getCurrentMonthParts,
  getLatestAttendanceMonthParts,
  isFutureDateKey,
  parseMonthKey,
  shiftMonth,
  toInputDate,
  TRAINER_ATTENDANCE_TRACKING_START,
} from '../utils/monthDates.js';
import { allowsManualClassHandlingHours, countsAsOifDay } from '../utils/trainerAttendanceTypes.js';
import { ROLES } from '../utils/roles.js';
import TrainerAttendanceSheetSetupModal from './TrainerAttendanceSheetSetupModal.jsx';
import { ExternalLinkIcon, SheetIcon } from './icons.jsx';

const TrainerAttendanceTab = () => {
  const { user, hasManagementRole } = useAuth();
  const canManageAll = hasManagementRole();
  const canEditFutureLeave = user?.role === ROLES.ADMIN;

  const [monthParts, setMonthParts] = useState(() =>
    clampMonthParts(getCurrentMonthParts())
  );
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [trainerSearch, setTrainerSearch] = useState('');
  const [sheetStatus, setSheetStatus] = useState(null);
  const [showSheetSetup, setShowSheetSetup] = useState(false);
  const scrollContainerRef = useRef(null);
  const gridDataRef = useRef(null);
  const monthCacheRef = useRef(new Map());

  const monthKey = formatMonthKey(monthParts.year, monthParts.month);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const latestMonth = useMemo(() => getLatestAttendanceMonthParts(), []);
  const trackingMonth = parseMonthKey(TRAINER_ATTENDANCE_TRACKING_START.slice(0, 7));

  const atEarliestMonth =
    monthParts.year === trackingMonth.year && monthParts.month === trackingMonth.month;
  const atLatestMonth =
    monthParts.year === latestMonth.year && monthParts.month === latestMonth.month;

  const filteredRows = useMemo(() => {
    if (!grid?.rows) return [];
    const query = trainerSearch.trim().toLowerCase();
    if (!query || !canManageAll) return grid.rows;
    return grid.rows.filter((row) => {
      const name = row.trainer.name?.toLowerCase() || '';
      const employeeId = row.trainer.employeeId?.toLowerCase() || '';
      return name.includes(query) || employeeId.includes(query);
    });
  }, [grid?.rows, trainerSearch, canManageAll]);

  const fetchGrid = useCallback(async ({ forceRefresh = false } = {}) => {
    const requestParams = { month: monthKey };
    const cachedMonth = monthCacheRef.current.get(monthKey);

    if (cachedMonth && !forceRefresh) {
      gridDataRef.current = cachedMonth;
      setGrid(cachedMonth);
      setLoading(false);
      setRefreshing(true);
    } else if (!cachedMonth) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    if (forceRefresh) {
      invalidateTrainerAttendanceGridCache();
      monthCacheRef.current.delete(monthKey);
    }

    try {
      const data = await getTrainerAttendanceGrid(requestParams, {
        preferCache: !forceRefresh,
        forceRefresh,
      });
      monthCacheRef.current.set(monthKey, data);
      gridDataRef.current = data;
      setGrid(data);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthKey]);

  useEffect(() => {
    fetchGrid();
  }, [fetchGrid]);

  const loadSheetStatus = useCallback(async () => {
    if (!canManageAll) return;
    try {
      setSheetStatus(await getTrainerAttendanceSheetStatus());
    } catch {
      setSheetStatus(null);
    }
  }, [canManageAll]);

  useEffect(() => {
    loadSheetStatus();
  }, [loadSheetStatus]);

  const scrollToTodayColumn = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !grid?.dates?.length) return;

    const todayKey = toInputDate(new Date());
    const anchor = container.querySelector(`[data-date-scroll-anchor="${todayKey}"]`);
    if (!anchor) {
      container.scrollLeft = 0;
      return;
    }

    const stickyCol = container.querySelector('.trainer-attendance-sticky-col');
    const stickyWidth = stickyCol?.getBoundingClientRect().width ?? 0;
    const containerLeft = container.getBoundingClientRect().left;
    const anchorLeft = anchor.getBoundingClientRect().left;
    container.scrollLeft = Math.max(0, container.scrollLeft + (anchorLeft - containerLeft) - stickyWidth);
  }, [grid?.dates]);

  const hasVisibleGrid = !loading && Boolean(grid?.dates?.length) && filteredRows.length > 0;

  useLayoutEffect(() => {
    if (!hasVisibleGrid) return;
    scrollToTodayColumn();
  }, [hasVisibleGrid, monthKey, scrollToTodayColumn]);

  const canEditTrainer = useCallback(
    (trainerId) => canManageAll || user?.trainer?.toString() === trainerId?.toString(),
    [canManageAll, user?.trainer]
  );

  const updateCell = useCallback((trainerId, dateKey, field, value) => {
    setGrid((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        rows: prev.rows.map((row) => {
          if (row.trainer._id !== trainerId) return row;
          const previousCell = row.days[dateKey] || {};
          const nextCell = {
            ...previousCell,
            [field]: value,
          };
          if (field === 'oifNumber') {
            nextCell.classHoursEditable = allowsManualClassHandlingHours(value);
            if (!nextCell.classHoursEditable) {
              // Campus / IT / empty — hours refresh from the server on save.
            } else if (
              previousCell.classHandlingHours === undefined
              || previousCell.classHandlingHours === null
              || !previousCell.classHoursEditable
            ) {
              nextCell.classHandlingHours = previousCell.classHandlingHours || 0;
            }
          }
          const nextDays = {
            ...row.days,
            [dateKey]: nextCell,
          };
          const dateKeys = prev.dates.map((date) => date.key);
          const totals = dateKeys.reduce(
            (acc, key) => {
              const cell = nextDays[key];
              if (!cell) return acc;
              return {
                mockPrepHours: acc.mockPrepHours + Number(cell.mockPrepHours || 0),
                classHandlingHours: acc.classHandlingHours + Number(cell.classHandlingHours || 0),
                oifDays: acc.oifDays + (countsAsOifDay(cell.oifNumber) ? 1 : 0),
                leaveDays: acc.leaveDays + (cell.isOnLeave ? 1 : 0),
                replacementRequiredDays:
                  acc.replacementRequiredDays
                  + (cell.isOnLeave && cell.isReplacementRequired ? 1 : 0),
                workingDays: acc.workingDays,
              };
            },
            {
              mockPrepHours: 0,
              classHandlingHours: 0,
              oifDays: 0,
              leaveDays: 0,
              replacementRequiredDays: 0,
              workingDays: dateKeys.length,
            }
          );
          return { ...row, days: nextDays, totals };
        }),
      };
      gridDataRef.current = next;
      monthCacheRef.current.set(prev.month, next);
      return next;
    });
  }, []);

  const handleSave = useCallback(async (trainerId, dateKey) => {
    const currentGrid = gridDataRef.current;
    const row = currentGrid?.rows.find((entry) => entry.trainer._id === trainerId);
    const cell = row?.days[dateKey];
    if (!cell) return;
    const isFuture = cell.isFuture || isFutureDateKey(dateKey);
    if (isFuture && !(cell.isOnLeave && canEditFutureLeave)) return;

    const saveKey = `${trainerId}|${dateKey}`;
    setSavingKey(saveKey);

    try {
      const saved = await upsertTrainerDailyAttendance({
        trainer: trainerId,
        date: dateKey,
        attendanceType: cell.attendanceType,
        oifNumber: cell.oifNumber,
        mockPrepHours: cell.mockPrepHours,
        classHandlingHours: cell.classHandlingHours,
        foodAllowance: cell.foodAllowance,
      });

      setGrid((prev) => {
        if (!prev) return prev;
        const next = {
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
                  attendanceType: saved.attendanceType,
                  oifNumber: saved.oifNumber,
                  oifDisplay: saved.oifDisplay,
                  foodAllowance: saved.foodAllowance,
                  mockPrepHours: saved.mockPrepHours,
                  classHandlingHours: saved.classHandlingHours,
                  classHoursEditable: saved.classHoursEditable,
                  isOnLeave: saved.isOnLeave,
                  isSundayWeekOff: saved.isSundayWeekOff,
                  isDefaultWeekOff: saved.isDefaultWeekOff,
                },
              },
            };
          }),
        };
        gridDataRef.current = next;
        monthCacheRef.current.set(next.month, next);
        return next;
      });
    } catch (err) {
      showError(getErrorMessage(err));
      fetchGrid({ forceRefresh: true });
    } finally {
      setSavingKey('');
    }
  }, [canEditFutureLeave, fetchGrid]);

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
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || refreshing}
            onClick={() => fetchGrid({ forceRefresh: true })}
          >
            Refresh
          </button>
        </div>
      </div>

      {canManageAll && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          {sheetStatus?.linked ? (
            <>
              <a
                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
                href={sheetStatus.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon size={16} aria-hidden="true" />
                Open attendance sheet
              </a>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
                onClick={() => setShowSheetSetup(true)}
              >
                <SheetIcon size={16} aria-hidden="true" />
                Sheet setup
              </button>
              <span className="text-muted small">
                Continuous attendance timeline refreshes every 5 minutes
              </span>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
              onClick={() => setShowSheetSetup(true)}
            >
              <SheetIcon size={16} aria-hidden="true" />
              Link attendance sheet
            </button>
          )}
        </div>
      )}

      {!loading && grid && (
        <div className="trainer-attendance-summary mb-3">
          <span className="trainer-attendance-pill">{monthLabel}</span>
          {refreshing && (
            <span className="trainer-attendance-pill text-muted">Refreshing...</span>
          )}
          <span className="trainer-attendance-pill">
            {grid.workingDays} day{grid.workingDays === 1 ? '' : 's'} in month
          </span>
          {grid.editableDays !== undefined && grid.editableDays < grid.workingDays && (
            <span className="trainer-attendance-pill">
              {grid.editableDays} open for entry
            </span>
          )}
          <span className="trainer-attendance-pill">
            {filteredRows.length} trainer{filteredRows.length === 1 ? '' : 's'}
            {trainerSearch.trim() && canManageAll && filteredRows.length !== grid.rows.length
              ? ` of ${grid.rows.length}`
              : ''}
          </span>
        </div>
      )}

      {canManageAll && !loading && grid?.rows?.length > 0 && (
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Filter trainers by name or ID..."
              value={trainerSearch}
              onChange={(e) => setTrainerSearch(e.target.value)}
              aria-label="Filter trainers in attendance grid"
            />
          </div>
        </div>
      )}

      {loading && (!grid || grid.month !== monthKey) ? (
        <LoadingSpinner message="Loading monthly attendance..." />
      ) : !filteredRows.length ? (
        <div className="text-center text-muted py-5">
          {trainerSearch.trim() ? 'No trainers match your filter.' : 'No trainers found for attendance.'}
        </div>
      ) : !grid.dates.length ? (
        <div className="text-center text-muted py-5">
          No working days to show for {monthLabel}.
        </div>
      ) : (
        <div className="trainer-attendance-grid" ref={scrollContainerRef}>
          <table className="table table-bordered table-sm align-middle mb-0 trainer-attendance-month-table">
            <colgroup>
              <col className="trainer-attendance-sticky-col" />
              {grid.dates.map((date) => (
                <Fragment key={`col-${date.key}`}>
                  <col className="trainer-attendance-oif-col" />
                  <col className="trainer-attendance-mock-col" />
                  <col className="trainer-attendance-class-col" />
                  <col className="trainer-attendance-food-col" />
                </Fragment>
              ))}
              <col className="trainer-attendance-totals-col" />
            </colgroup>
            <thead className="table-light">
              <tr>
                <th rowSpan="2" className="trainer-attendance-sticky-col">Trainer</th>
                {grid.dates.map((date) => (
                  <th
                    key={`${date.key}-headers`}
                    data-date-scroll-anchor={date.key}
                    className={`text-center small trainer-attendance-day-header ${
                      date.isFuture ? 'trainer-attendance-future' : ''
                    } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    colSpan="4"
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
                      className={`text-center small trainer-attendance-subheader trainer-attendance-oif-header ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      OIF
                    </th>
                    <th
                      className={`text-center small trainer-attendance-subheader trainer-attendance-mock-header ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      Mock
                    </th>
                    <th
                      className={`text-center small trainer-attendance-subheader trainer-attendance-class-header ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      Class
                    </th>
                    <th
                      className={`text-center small trainer-attendance-subheader trainer-attendance-food-header ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      Food
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <TrainerAttendanceRow
                  key={row.trainer._id}
                  row={row}
                  dates={grid.dates}
                  canEditTrainer={canEditTrainer}
                  canEditFutureLeave={canEditFutureLeave}
                  savingKey={savingKey}
                  onUpdateCell={updateCell}
                  onSave={handleSave}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showSheetSetup && canManageAll && (
        <TrainerAttendanceSheetSetupModal
          show
          initialUrl={sheetStatus?.spreadsheetUrl || ''}
          onClose={() => setShowSheetSetup(false)}
          onLinked={() => {
            setShowSheetSetup(false);
            loadSheetStatus();
            showSuccess('Trainer attendance Google Sheet linked.');
          }}
        />
      )}
    </>
  );
};

export default TrainerAttendanceTab;
