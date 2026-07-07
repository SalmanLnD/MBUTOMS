import { useState, useCallback, useEffect, useMemo } from 'react';
import Topbar from '../components/Topbar.jsx';
import TrainerTimetableGrid from '../components/TrainerTimetableGrid.jsx';
import TimetableSlotModal from '../components/TimetableSlotModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { getTimetableBoard } from '../services/scheduleService.js';
import { getTrainers } from '../services/trainerService.js';
import { getSubjects } from '../services/subjectService.js';
import {
  getTimetableSheetStatus,
} from '../services/sheetsService.js';
import TimetableSheetSetupModal from '../components/TimetableSheetSetupModal.jsx';
import { SheetIcon, ExternalLinkIcon } from '../components/icons.jsx';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import { buildFixedSlotsForSubject, resolveTrainerGridSlots } from '../utils/timetableGrid.js';
import { shouldShowTimingsInCells } from '../utils/timetableSlots.js';
import { getSubjectSlotProfile } from '../utils/subjectSlotTimings.js';
import { getEffectiveSubjectCode, scheduleMatchesSubject } from '../utils/scheduleSubject.js';
import { getSubjectSemesterRoman } from '../utils/classPy.js';

const inferSemesterForTrainer = (trainerCode, schedules, subject) => {
  const fromSubject = getSubjectSemesterRoman(subject);
  if (fromSubject) return fromSubject;
  const trainerSchedules = schedules.filter((schedule) => schedule.trainerCode === trainerCode);
  if (trainerSchedules.length) {
    return trainerSchedules[0].semester || 'III';
  }
  return 'III';
};

const buildSubjectLabel = (visibleSchedules, trainerSubjects, selectedSubject, trainerCode) => {
  if (selectedSubject) {
    return `${selectedSubject.name} (${selectedSubject.code})`;
  }

  const codes = [
    ...new Set([
      ...visibleSchedules
        .map((schedule) => getEffectiveSubjectCode(schedule, trainerCode))
        .filter(Boolean),
      ...trainerSubjects.map((subject) => subject.code).filter(Boolean),
    ]),
  ];

  if (codes.length > 1) return 'All subjects';
  if (codes.length === 1) {
    const matched = trainerSubjects.find((subject) => subject.code === codes[0]);
    return matched ? `${matched.name} (${matched.code})` : codes[0];
  }
  return '';
};

const Timetable = () => {
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'campus_manager');

  const [trainers, setTrainers] = useState([]);
  const [schedulesByTrainer, setSchedulesByTrainer] = useState({});
  const [allSubjects, setAllSubjects] = useState([]);
  const [trainerSubjectsCache, setTrainerSubjectsCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [trainerSearch, setTrainerSearch] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [slotModal, setSlotModal] = useState(null);

  const [sheetStatus, setSheetStatus] = useState(null);
  const [showSheetSetup, setShowSheetSetup] = useState(false);

  const debouncedTrainerSearch = useDebounce(trainerSearch);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [trainerData, subjectData, boardData] = await Promise.all([
        getTrainers({ limit: 200, sortBy: 'employeeId', sortOrder: 'asc' }),
        getSubjects({ limit: 100 }),
        getTimetableBoard({ referenceDate: toInputDate(new Date()) }),
      ]);
      const trainerList = trainerData.trainers || [];

      setTrainers(trainerList);
      setSchedulesByTrainer(boardData.schedulesByTrainer || {});
      setAllSubjects(subjectData.subjects || []);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadSheetStatus = useCallback(async () => {
    try {
      const status = await getTimetableSheetStatus();
      setSheetStatus(status);
    } catch {
      setSheetStatus(null);
    }
  }, []);

  useEffect(() => {
    loadSheetStatus();
  }, [loadSheetStatus]);

  const handleSheetLinked = () => {
    setShowSheetSetup(false);
    loadSheetStatus();
    showSuccess('Google Sheet linked. Use TOMS Timetable → Refresh now in the sheet, or wait up to 5 minutes.');
  };

  const trainerOptions = useMemo(
    () =>
      [...trainers].sort((a, b) =>
        a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true, sensitivity: 'base' })
      ),
    [trainers]
  );

  const selectedSubject = useMemo(
    () => allSubjects.find((subject) => subject._id === selectedSubjectId) || null,
    [allSubjects, selectedSubjectId]
  );

  const visibleTrainerEntries = useMemo(() => {
    const search = debouncedTrainerSearch.trim().toLowerCase();

    return trainerOptions
      .map((trainer) => {
        const trainerSchedules = schedulesByTrainer[trainer.employeeId] || [];
        const visibleSchedules = selectedSubject
          ? trainerSchedules.filter((schedule) =>
              scheduleMatchesSubject(schedule, selectedSubject, trainer.employeeId)
            )
          : trainerSchedules;

        return { trainer, visibleSchedules };
      })
      .filter(({ trainer, visibleSchedules }) => {
        if (search) {
          const matchesSearch =
            trainer.name.toLowerCase().includes(search)
            || trainer.employeeId.toLowerCase().includes(search);
          if (!matchesSearch) return false;
        }

        if (selectedSubject && !visibleSchedules.length) return false;
        return true;
      });
  }, [trainerOptions, schedulesByTrainer, debouncedTrainerSearch, selectedSubject]);

  const totalVisibleSlots = useMemo(
    () => visibleTrainerEntries.reduce((sum, entry) => sum + entry.visibleSchedules.length, 0),
    [visibleTrainerEntries]
  );

  const loadTrainerSubjectsForModal = async (trainerId) => {
    if (trainerSubjectsCache[trainerId]) {
      return trainerSubjectsCache[trainerId];
    }
    const data = await getSubjects({ trainer: trainerId, limit: 50 });
    const subjects = data.subjects || [];
    setTrainerSubjectsCache((current) => ({ ...current, [trainerId]: subjects }));
    return subjects;
  };

  const getTrainerSubjectsForDisplay = (trainer, visibleSchedules) => {
    const scheduledCodes = [
      ...new Set(
        visibleSchedules
          .map((schedule) => getEffectiveSubjectCode(schedule, trainer.employeeId))
          .filter(Boolean)
      ),
    ];
    const codes = scheduledCodes.length
      ? scheduledCodes
      : [...new Set((trainer.subjects || []).map((subject) => subject.code).filter(Boolean))];

    return codes.map((code) => {
      const matched = allSubjects.find((subject) => subject.code === code);
      if (matched) return matched;

      const assigned = (trainer.subjects || []).find((subject) => subject.code === code);
      if (assigned?.slotTimings) return assigned;

      const profile = getSubjectSlotProfile(code);
      if (!profile) return null;
      return {
        _id: code,
        code,
        name: assigned?.name || code,
        slotCount: profile.slotCount,
        slotTimings: profile.timings,
      };
    }).filter(Boolean);
  };

  const handleCellClick = async ({ trainerCode, schedule, day, slot }) => {
    if (!canEdit || !editMode) return;

    const trainer = trainerOptions.find((item) => item.employeeId === trainerCode);
    if (!trainer) return;

    let trainerSubjects = [];
    try {
      trainerSubjects = await loadTrainerSubjectsForModal(trainer._id);
    } catch (err) {
      showError(getErrorMessage(err));
      return;
    }

    const activeSubject = selectedSubject
      || trainerSubjects.find((item) => item.code === schedule?.subjectCode)
      || (trainerSubjects.length === 1 ? trainerSubjects[0] : null);

    if (!activeSubject && !schedule) {
      showError('Select a subject filter or assign a subject to this trainer before adding slots.');
      return;
    }

    setSlotModal({
      trainerCode,
      schedule,
      day,
      slot,
      subject: activeSubject,
      subjects: trainerSubjects,
      semester: schedule?.semester
        || inferSemesterForTrainer(
          trainerCode,
          schedulesByTrainer[trainerCode] || [],
          activeSubject
        ),
    });
  };

  const handleSlotModalClose = async (saved) => {
    setSlotModal(null);
    if (saved) {
      showSuccess('Timetable updated successfully.');
      await loadData();
    }
  };

  const trainerLabel = (trainer) =>
    trainer.name && trainer.name !== trainer.employeeId
      ? `${trainer.name} (${trainer.employeeId})`
      : trainer.employeeId;

  return (
    <>
      <Topbar title="Timetable" />

      <div className="row g-3 mb-3 align-items-end timetable-controls">
        <div className="col-md-4">
          <label htmlFor="trainer-search" className="form-label fw-semibold">
            Search Trainers
          </label>
          <input
            id="trainer-search"
            type="search"
            className="form-control"
            placeholder="Name or employee ID..."
            value={trainerSearch}
            onChange={(e) => setTrainerSearch(e.target.value)}
          />
        </div>

        <div className="col-md-4">
          <label htmlFor="subject-filter" className="form-label fw-semibold">
            Subject
          </label>
          <select
            id="subject-filter"
            className="form-select"
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
          >
            <option value="">All subjects</option>
            {allSubjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name} ({subject.code})
              </option>
            ))}
          </select>
        </div>

        {canEdit && (
          <div className="col-md-4 d-flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn ${editMode ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => setEditMode((current) => !current)}
            >
              {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </button>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          {sheetStatus?.linked ? (
            <>
              <a
                className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
                href={sheetStatus.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon size={16} />
                Open Sheet
              </a>
              <button
                type="button"
                className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
                onClick={() => setShowSheetSetup(true)}
              >
                <SheetIcon size={16} />
                Sheet setup
              </button>
              <span className="text-muted small">
                Auto-refreshes every 5 min from TOMS (or use menu TOMS Timetable → Refresh now)
              </span>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
              onClick={() => setShowSheetSetup(true)}
            >
              <SheetIcon size={16} />
              Link to Sheets
            </button>
          )}
        </div>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 timetable-summary-bar">
        <p className="text-muted small mb-0">
          Showing {visibleTrainerEntries.length} trainer timetable
          {visibleTrainerEntries.length === 1 ? '' : 's'} ({totalVisibleSlots} slot
          {totalVisibleSlots === 1 ? '' : 's'})
        </p>
        {editMode && (
          <span className="text-primary small">
            Click a cell on any trainer grid to add or edit a slot.
          </span>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading timetables..." />
      ) : visibleTrainerEntries.length === 0 ? (
        <div className="card table-card">
          <div className="card-body text-center text-muted py-5">
            No trainer timetables match the current filters.
          </div>
        </div>
      ) : (
        <div
          className={`timetable-all-trainers ${
            visibleTrainerEntries.length > 1 ? 'timetable-all-trainers--two-col' : ''
          }`}
        >
          {visibleTrainerEntries.map(({ trainer, visibleSchedules }) => {
            const trainerSubjectsForDisplay = getTrainerSubjectsForDisplay(
              trainer,
              visibleSchedules
            );
            const showTimingsInCells = shouldShowTimingsInCells(
              trainerSubjectsForDisplay,
              selectedSubject
            );
            const fixedSlots = resolveTrainerGridSlots({
              selectedSubject,
              trainerSubjects: trainerSubjectsForDisplay,
              visibleSchedules,
              showTimingsInCells,
            });
            const subjectLabel = buildSubjectLabel(
              visibleSchedules,
              trainerSubjectsForDisplay,
              selectedSubject,
              trainer.employeeId
            );

            return (
              <section key={trainer.employeeId} className="timetable-trainer-section">
                <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
                  <h6 className="mb-0 fw-semibold timetable-trainer-title">{trainerLabel(trainer)}</h6>
                  <span className="timetable-slot-count">
                    {visibleSchedules.length} slot{visibleSchedules.length === 1 ? '' : 's'}
                  </span>
                </div>
                <TrainerTimetableGrid
                  schedules={visibleSchedules}
                  trainerCode={trainer.employeeId}
                  subjectLabel={subjectLabel}
                  fixedSlots={fixedSlots}
                  editMode={canEdit && editMode}
                  showSubjectInCells={!selectedSubject}
                  showTimingsInCells={showTimingsInCells}
                  onCellClick={(cellData) => handleCellClick({ ...cellData, trainerCode: trainer.employeeId })}
                />
              </section>
            );
          })}
        </div>
      )}

      {slotModal && (
        <TimetableSlotModal
          schedule={slotModal.schedule}
          trainerCode={slotModal.trainerCode}
          day={slotModal.day}
          slot={slotModal.slot}
          subject={slotModal.subject}
          subjects={slotModal.subjects}
          semester={slotModal.semester}
          onClose={handleSlotModalClose}
        />
      )}

      {showSheetSetup && (
        <TimetableSheetSetupModal
          show
          initialUrl={sheetStatus?.spreadsheetUrl || ''}
          onClose={() => setShowSheetSetup(false)}
          onLinked={handleSheetLinked}
        />
      )}
    </>
  );
};

export default Timetable;
