import AsyncButton from './AsyncButton.jsx';
import { createKeyedAsyncQueue } from '../utils/keyedAsyncQueue.js';
import { attendanceCellFingerprint, attendanceCellPayload, mergeFailedAttendanceDrafts } from '../utils/attendanceDraft.js';
import Pagination from './Pagination.jsx';
import { useState, useEffect, useLayoutEffect, useCallback, Fragment, useMemo, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import TrainerAttendanceRow from './TrainerAttendanceRow.jsx';
import StyledSelect from './StyledSelect.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getTrainerAttendanceGrid,
  getTrainerAttendanceSheetStatus,
  upsertTrainerDailyAttendance,
  invalidateTrainerAttendanceGridCache,
  requestWhatsappPunchSync,
  getWhatsappPunchSyncStatus,
} from '../services/attendanceService.js';
import { TRAINER_ATTENDANCE_TYPES } from '../utils/trainerAttendanceTypes.js';
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
  toAttendanceDateKey,
  TRAINER_ATTENDANCE_TRACKING_START,
} from '../utils/monthDates.js';
import { allowsManualClassHandlingHours, countsAsOifDay } from '../utils/trainerAttendanceTypes.js';
import { ROLES } from '../utils/roles.js';
import TrainerAttendanceSheetSetupModal from './TrainerAttendanceSheetSetupModal.jsx';
import { CalendarIcon, ExternalLinkIcon, SheetIcon } from './icons.jsx';
import OfficialHolidayModal from './OfficialHolidayModal.jsx';
import { lockBodyScroll, unlockBodyScroll } from '../utils/modalManager.js';

const TrainerAttendanceTab = () => {
  const { user, hasFullAccess } = useAuth();
  const canManageAll = hasFullAccess();
  const canEditFutureLeave = user?.role === ROLES.ADMIN;
  const canManageHolidays = user?.role === ROLES.ADMIN;

  const [monthParts, setMonthParts] = useState(() =>
    clampMonthParts(getCurrentMonthParts())
  );
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKeys, setSavingKeys] = useState(() => new Set());
  const [trainerPage, setTrainerPage] = useState(1);
  const [trainerPageSize, setTrainerPageSize] = useState(10);
  const savedCells = useRef(new Map());
  const failedDrafts = useRef(new Map());
  const requestedCells = useRef(new Map());
  const gridRequestId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const saveQueueRef = useRef(createKeyedAsyncQueue());
  const [trainerSearch, setTrainerSearch] = useState('');
  const [sheetStatus, setSheetStatus] = useState(null);
  const [showSheetSetup, setShowSheetSetup] = useState(false);
  const [whatsappSyncing, setWhatsappSyncing] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef(null);
  const fullscreenButtonRef = useRef(null);

  useEffect(() => {
    if (!fullscreen) return undefined;
    lockBodyScroll();
    const siblings = [];
    let node = panelRef.current;
    while (node && node !== document.body) {
      for (const sibling of node.parentElement?.children || []) {
        if (sibling !== node) { siblings.push([sibling, sibling.inert]); sibling.inert = true; }
      }
      node = node.parentElement;
    }
    const onKeyDown = event => {
      if (document.querySelector('.toms-modal-dialog, .toms-styled-select__menu, .toms-styled-multi-select__menu')) return;
      if (event.key === 'Escape') { event.preventDefault(); setFullscreen(false); }
      if (event.key === 'Tab') {
        const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      siblings.forEach(([element, inert]) => { element.inert = inert; });
      unlockBodyScroll();
      fullscreenButtonRef.current?.focus({ preventScroll: true });
    };
  }, [fullscreen]);
  const scrollContainerRef = useRef(null);
  const gridDataRef = useRef(null);
  const monthCacheRef = useRef(new Map());
  const cacheSession = useRef(null);
  const sessionKey = JSON.stringify([user?._id, user?.sessionVersion, user?.role, user?.trainer, user?.impersonating]);
  const currentSession = useRef(sessionKey);
  currentSession.current = sessionKey;

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

  const trainerPages = Math.max(1, Math.ceil(filteredRows.length / trainerPageSize));
  const visibleTrainerPage = Math.min(trainerPage, trainerPages);
  const visibleRows = useMemo(() => filteredRows.slice(
    (visibleTrainerPage - 1) * trainerPageSize, visibleTrainerPage * trainerPageSize,
  ), [filteredRows, visibleTrainerPage, trainerPageSize]);
  const savingDatesByTrainer = useMemo(() => {
    const byTrainer = new Map();
    for (const key of savingKeys) {
      const [trainerId, date] = key.split('|');
      byTrainer.set(trainerId, [...(byTrainer.get(trainerId) || []), date]);
    }
    return new Map([...byTrainer].map(([trainerId, dates]) => [trainerId, dates.sort().join(',')]));
  }, [savingKeys]);

  useEffect(() => { setTrainerPage(1); }, [monthKey, trainerSearch]);

  const fetchGrid = useCallback(async ({ forceRefresh = false } = {}) => {
    const requestId = ++gridRequestId.current;
    if (cacheSession.current !== sessionKey) {
      cacheSession.current = sessionKey;
      monthCacheRef.current.clear();
      savedCells.current.clear();
      failedDrafts.current.clear();
      requestedCells.current.clear();
      saveQueueRef.current = createKeyedAsyncQueue();
      setSavingKeys(new Set());
      gridDataRef.current = null;
      setGrid(null);
    }
    // Refreshes from other dialogs must not replace a cell while its write is pending.
    const pendingSaves = [...requestedCells.current.values()].map(request => request.promise);
    if (pendingSaves.length) {
      setRefreshing(true);
      await Promise.allSettled(pendingSaves);
      if (requestId !== gridRequestId.current || !mounted.current) return;
    }
    const requestParams = { month: monthKey };
    const todayKey = toAttendanceDateKey();
    const cacheRecord = monthCacheRef.current.get(monthKey);
    const cachedMonth = cacheRecord?.todayKey === todayKey ? cacheRecord.data : null;

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
      const persistedData = await getTrainerAttendanceGrid(requestParams, {
        preferCache: !forceRefresh,
        forceRefresh,
      });
      if (requestId !== gridRequestId.current) return;
      savedCells.current.clear();
      for (const row of persistedData.rows || []) {
        for (const [date, cell] of Object.entries(row.days || {})) {
          savedCells.current.set(`${row.trainer._id}|${date}`, attendanceCellFingerprint(cell));
        }
      }
      const data = mergeFailedAttendanceDrafts(persistedData, failedDrafts.current);
      monthCacheRef.current.set(monthKey, { todayKey, data });
      while (monthCacheRef.current.size > 6) monthCacheRef.current.delete(monthCacheRef.current.keys().next().value);
      gridDataRef.current = data;
      setGrid(data);
    } catch (err) {
      if (requestId === gridRequestId.current) showError(getErrorMessage(err));
    } finally {
      if (requestId === gridRequestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [monthKey, sessionKey]);

  useEffect(() => {
    fetchGrid();
    return () => { gridRequestId.current++; };
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

    const todayKey = toAttendanceDateKey();
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
    () => canManageAll && !refreshing,
    [canManageAll, refreshing]
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
          const draftKey = `${trainerId}|${dateKey}`;
          if (failedDrafts.current.has(draftKey)) {
            if (attendanceCellFingerprint(nextCell) === savedCells.current.get(draftKey)) failedDrafts.current.delete(draftKey);
            else failedDrafts.current.set(draftKey, attendanceCellPayload(nextCell));
          }
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
      monthCacheRef.current.set(prev.month, { todayKey: toAttendanceDateKey(), data: next });
      return next;
    });
  }, []);

  const handleSave = useCallback(async (trainerId, dateKey) => {
    const currentGrid = gridDataRef.current;
    const saveSession = currentSession.current;
    const saveMonth = currentGrid?.month;
    const row = currentGrid?.rows.find((entry) => entry.trainer._id === trainerId);
    const currentCell = row?.days[dateKey];
    if (!currentCell) return;
    const cell = { ...currentCell };
    const isFuture = cell.isFuture || isFutureDateKey(dateKey);
    if (isFuture && !(cell.isOnLeave && canEditFutureLeave)) return;

    const saveKey = `${trainerId}|${dateKey}`;
    const fingerprint = attendanceCellFingerprint(cell);
    const requested = requestedCells.current.get(saveKey);
    if (requested?.fingerprint === fingerprint) return requested.promise;
    if (!requested && savedCells.current.get(saveKey) === fingerprint) return;
    setSavingKeys(current => new Set(current).add(saveKey));

    const promise = saveQueueRef.current.run(saveKey, async () => {
      if (!mounted.current || saveSession !== currentSession.current) return;
      try {
        const saved = await upsertTrainerDailyAttendance({
          trainer: trainerId,
          date: dateKey,
          ...attendanceCellPayload(cell),
        });
        if (!mounted.current || saveSession !== currentSession.current) return;
        failedDrafts.current.delete(saveKey);
        savedCells.current.set(saveKey, attendanceCellFingerprint({ ...cell, ...saved }));

        setGrid((prev) => {
          if (!prev || prev.month !== saveMonth || saveSession !== currentSession.current) return prev;
          const next = {
            ...prev,
            rows: prev.rows.map((entry) => {
              if (entry.trainer._id !== trainerId) return entry;
              const latestCell = entry.days[dateKey] || {};
              const hasNewerEdits = ['attendanceType', 'oifNumber', 'mockPrepHours', 'classHandlingHours', 'foodAllowance']
                .some(field => latestCell[field] !== cell[field]);
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
                    isOfficialHoliday: saved.isOfficialHoliday,
                    isHolidayOff: saved.isHolidayOff,
                    isDefaultWeekOff: saved.isDefaultWeekOff,
                    // An older response must not overwrite a later queued edit.
                    ...(hasNewerEdits ? {
                      attendanceType: latestCell.attendanceType,
                      oifNumber: latestCell.oifNumber,
                      mockPrepHours: latestCell.mockPrepHours,
                      classHandlingHours: latestCell.classHandlingHours,
                      foodAllowance: latestCell.foodAllowance,
                    } : {}),
                  },
                },
              };
            }),
          };
          gridDataRef.current = next;
          monthCacheRef.current.set(next.month, { todayKey: toAttendanceDateKey(), data: next });
          return next;
        });
      } catch (err) {
        if (!mounted.current || saveSession !== currentSession.current) return;
        const payload = err?.response?.data;
        if (payload?.code === 'INSUFFICIENT_COMP_OFF') {
          failedDrafts.current.delete(saveKey);
          showError(payload.message || 'Insufficient comp-off balance. Reverted to Leave.');
          setGrid((prev) => {
            if (!prev || prev.month !== saveMonth || saveSession !== currentSession.current) return prev;
            const revertTo = payload.revertTo || TRAINER_ATTENDANCE_TYPES.LEAVE;
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
                      attendanceType: revertTo,
                      oifNumber: '',
                      mockPrepHours: 0,
                    },
                  },
                };
              }),
            };
            gridDataRef.current = next;
            monthCacheRef.current.set(next.month, { todayKey: toAttendanceDateKey(), data: next });
            return next;
          });
        } else {
          const latest = gridDataRef.current?.rows.find(row => row.trainer._id === trainerId)?.days[dateKey];
          failedDrafts.current.set(saveKey, attendanceCellPayload(latest || cell));
          showError(getErrorMessage(err));
        }
      }
    }).finally(() => {
      if (!mounted.current || saveSession !== currentSession.current) return;
      if (requestedCells.current.get(saveKey)?.promise === promise) requestedCells.current.delete(saveKey);
      if (!saveQueueRef.current.has(saveKey)) {
        setSavingKeys(current => {
          const next = new Set(current);
          next.delete(saveKey);
          return next;
        });
      }
    });
    requestedCells.current.set(saveKey, { fingerprint, promise });
    return promise;
  }, [canEditFutureLeave]);

  const pollWhatsappSyncJob = useCallback(async (jobId) => {
    const started = Date.now();
    while (Date.now() - started < 180000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 5000));
      // eslint-disable-next-line no-await-in-loop
      const status = await getWhatsappPunchSyncStatus();
      const job = status?.job;
      if (!job || (jobId && job._id !== jobId)) continue;
      if (job.status === 'completed') {
        return job;
      }
      if (job.status === 'failed') {
        throw new Error(job.error || 'WhatsApp punch sync failed');
      }
    }
    throw new Error('WhatsApp punch sync is still running. Refresh attendance in a minute.');
  }, []);

  const handleWhatsappSync = useCallback(async () => {
    setWhatsappSyncing(true);
    try {
      const data = await requestWhatsappPunchSync({
        lookbackHours: 48,
        force: true,
      });
      if (data?.transport === 'direct' && data?.job?.status === 'completed') {
        showSuccess(
          `WhatsApp punches synced (${data.job.result?.counts?.recorded || 0} recorded). Refreshing attendance...`
        );
        await fetchGrid({ forceRefresh: true });
        return;
      }

      showSuccess(data?.message || 'WhatsApp punch sync queued');
      const job = await pollWhatsappSyncJob(data?.job?._id);
      showSuccess(
        `WhatsApp punches synced (${job?.result?.counts?.recorded || 0} recorded). Refreshing attendance...`
      );
      await fetchGrid({ forceRefresh: true });
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setWhatsappSyncing(false);
    }
  }, [fetchGrid, pollWhatsappSyncJob]);

  const monthLabel = grid?.monthLabel || formatMonthLabel(monthParts.year, monthParts.month);

  return (
    <section ref={panelRef} className={`trainer-attendance-panel${fullscreen ? ' trainer-attendance-panel--fullscreen' : ''}`} aria-label="Monthly trainer attendance">
      <div className="trainer-attendance-toolbar mb-2">
        <h5 className="mb-0">Monthly Trainer Attendance</h5>
        <AsyncButton ref={fullscreenButtonRef} type="button" className="btn btn-outline-primary btn-sm"
          aria-pressed={fullscreen} onClick={() => setFullscreen(value => !value)} title={fullscreen ? 'Exit full screen (Esc)' : 'Expand attendance to full screen'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d={fullscreen ? 'M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5' : 'M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5'} />
          </svg> {fullscreen ? 'Exit full screen' : 'Full screen'}
        </AsyncButton>

        <div className="trainer-attendance-month-controls">
          <AsyncButton
            type="button"
            className="btn btn-outline-secondary btn-sm"
            aria-label="Previous month"
            disabled={atEarliestMonth || savingKeys.size > 0}
            onClick={() => setMonthParts((current) => shiftMonth(current, -1))}
          >
            ‹
          </AsyncButton>
          <StyledSelect
            size="sm"
            className="trainer-attendance-month-select"
            value={monthKey}
            disabled={savingKeys.size > 0}
            onChange={(e) => setMonthParts(parseMonthKey(e.target.value))}
            aria-label="Select month"
            options={monthOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <AsyncButton
            type="button"
            className="btn btn-outline-secondary btn-sm"
            aria-label="Next month"
            disabled={atLatestMonth || savingKeys.size > 0}
            onClick={() => setMonthParts((current) => shiftMonth(current, 1))}
          >
            ›
          </AsyncButton>
          <AsyncButton
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setMonthParts(clampMonthParts(getCurrentMonthParts()))}
            disabled={savingKeys.size > 0}
          >
            This Month
          </AsyncButton>
          <AsyncButton
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || refreshing || savingKeys.size > 0}
            onClick={() => fetchGrid({ forceRefresh: true })}
          >
            Refresh
          </AsyncButton>
        </div>
      </div>

      {!canManageAll && (
        <p className="text-muted small mb-3">Your attendance is read-only.</p>
      )}

      {(canManageAll || canManageHolidays) && (
        <div className="trainer-attendance-tools d-flex flex-wrap align-items-center gap-2 mb-2">
          {canManageHolidays && (
            <AsyncButton
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
              onClick={() => setShowHolidays(true)}
            >
              <CalendarIcon size={16} aria-hidden="true" />
              Holidays
            </AsyncButton>
          )}
          {canManageAll && (
            sheetStatus?.linked ? (
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
                <AsyncButton
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
                  onClick={() => setShowSheetSetup(true)}
                >
                  <SheetIcon size={16} aria-hidden="true" />
                  Sheet setup
                </AsyncButton>
              </>
            ) : (
              <AsyncButton
                type="button"
                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
                onClick={() => setShowSheetSetup(true)}
              >
                <SheetIcon size={16} aria-hidden="true" />
                Link attendance sheet
              </AsyncButton>
            )
          )}
        </div>
      )}

      {!loading && grid && (
        <div className="trainer-attendance-summary mb-2">
          <span className="trainer-attendance-pill">{monthLabel}</span>
          {refreshing && (
            <span className="trainer-attendance-pill text-muted">Refreshing...</span>
          )}
          {savingKeys.size > 0 && (
            <span className="trainer-attendance-pill text-primary" role="status">
              Saving {savingKeys.size} attendance {savingKeys.size === 1 ? 'entry' : 'entries'}…
            </span>
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
        <div className="trainer-attendance-search mb-2">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Filter trainers by name or ID..."
              value={trainerSearch}
              onChange={(e) => setTrainerSearch(e.target.value)}
              aria-label="Filter trainers in attendance grid"
            />
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
                    } ${date.isHoliday ? 'trainer-attendance-holiday' : date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    colSpan="4"
                    title={date.holidayName ? `${date.key} — ${date.holidayName}` : date.key}
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
                      } ${date.isHoliday ? 'trainer-attendance-holiday' : date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      OIF
                    </th>
                    <th
                      className={`text-center small trainer-attendance-subheader trainer-attendance-mock-header ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isHoliday ? 'trainer-attendance-holiday' : date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      Mock
                    </th>
                    <th
                      className={`text-center small trainer-attendance-subheader trainer-attendance-class-header ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isHoliday ? 'trainer-attendance-holiday' : date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      Class
                    </th>
                    <th
                      className={`text-center small trainer-attendance-subheader trainer-attendance-food-header ${
                        date.isFuture ? 'trainer-attendance-future' : ''
                      } ${date.isHoliday ? 'trainer-attendance-holiday' : date.isWeekend ? 'trainer-attendance-weekend' : ''}`}
                    >
                      Food
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <TrainerAttendanceRow
                  key={row.trainer._id}
                  row={row}
                  dates={grid.dates}
                  canEditTrainer={canEditTrainer}
                  canEditFutureLeave={canEditFutureLeave}
                  savingDateKeys={savingDatesByTrainer.get(row.trainer._id) || ''}
                  onUpdateCell={updateCell}
                  onSave={handleSave}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && grid && filteredRows.length > 0 && (
        <Pagination
          pagination={{ page: visibleTrainerPage, pages: trainerPages, total: filteredRows.length, limit: trainerPageSize }}
          pageSize={trainerPageSize}
          onPageChange={setTrainerPage}
          onPageSizeChange={size => { setTrainerPageSize(size); setTrainerPage(1); }}
          pageSizeOptions={[10, 20, 50]}
          sizeLabel="Trainers per page"
          showSummary
          align="between"
        />
      )}

      {showSheetSetup && canManageAll && (
        <TrainerAttendanceSheetSetupModal
          show
          initialUrl={sheetStatus?.spreadsheetUrl || ''}
          onClose={() => setShowSheetSetup(false)}
          onLinked={() => {
            setShowSheetSetup(false);
            showSuccess('Trainer attendance Google Sheet linked.');
            return loadSheetStatus();
          }}
        />
      )}

      {showHolidays && canManageHolidays && (
        <OfficialHolidayModal
          show
          onClose={() => setShowHolidays(false)}
          onChanged={() => fetchGrid({ forceRefresh: true })}
        />
      )}
    </section>
  );
};

export default TrainerAttendanceTab;
