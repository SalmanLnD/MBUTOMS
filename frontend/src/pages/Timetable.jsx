import { useState, useCallback, useEffect, useMemo } from 'react';
import Topbar from '../components/Topbar.jsx';
import TrainerTimetableGrid from '../components/TrainerTimetableGrid.jsx';
import TimetableSlotModal from '../components/TimetableSlotModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getSchedules } from '../services/scheduleService.js';
import { getTrainers } from '../services/trainerService.js';
import { getSubjects } from '../services/subjectService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import { buildFixedSlotsForSubject } from '../utils/timetableGrid.js';
import { shouldShowTimingsInCells } from '../utils/timetableSlots.js';
import { getEffectiveSubjectCode, scheduleMatchesSubject } from '../utils/scheduleSubject.js';

const Timetable = () => {
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'campus_manager');

  const [schedules, setSchedules] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [trainerSubjects, setTrainerSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [slotModal, setSlotModal] = useState(null);

  const fetchTrainers = useCallback(async () => {
    try {
      const trainerData = await getTrainers({ limit: 200, sortBy: 'employeeId', sortOrder: 'asc' });
      setTrainers(trainerData.trainers || []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const fetchSchedules = useCallback(async (trainerCode) => {
    if (!trainerCode) {
      setSchedules([]);
      return;
    }

    setLoading(true);
    try {
      const scheduleData = await getSchedules({
        semester: 'III',
        trainerCode,
        referenceDate: toInputDate(new Date()),
      });
      setSchedules(scheduleData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  useEffect(() => {
    if (selectedTrainer) {
      fetchSchedules(selectedTrainer);
    }
  }, [selectedTrainer, fetchSchedules]);

  const trainerOptions = useMemo(
    () =>
      [...trainers].sort((a, b) =>
        a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true, sensitivity: 'base' })
      ),
    [trainers]
  );

  const trainerNameByCode = useMemo(() => {
    const map = {};
    trainers.forEach((trainer) => {
      map[trainer.employeeId] = trainer.name;
    });
    return map;
  }, [trainers]);

  const selectedTrainerRecord = useMemo(
    () => trainerOptions.find((trainer) => trainer.employeeId === selectedTrainer),
    [trainerOptions, selectedTrainer]
  );

  useEffect(() => {
    if (trainerOptions.length && !selectedTrainer) {
      setSelectedTrainer(trainerOptions[0].employeeId);
    }
  }, [trainerOptions, selectedTrainer]);

  useEffect(() => {
    const loadTrainerSubjects = async () => {
      if (!selectedTrainerRecord?._id) {
        setTrainerSubjects([]);
        return;
      }

      setSubjectsLoading(true);
      try {
        const data = await getSubjects({ trainer: selectedTrainerRecord._id, limit: 50 });
        setTrainerSubjects(data.subjects || []);
      } catch (err) {
        setError(getErrorMessage(err));
        setTrainerSubjects([]);
      } finally {
        setSubjectsLoading(false);
      }
    };

    loadTrainerSubjects();
    setSelectedSubjectId('');
  }, [selectedTrainerRecord?._id]);

  const selectedSubject = useMemo(
    () => trainerSubjects.find((subject) => subject._id === selectedSubjectId) || null,
    [trainerSubjects, selectedSubjectId]
  );

  const trainerSchedules = useMemo(() => schedules, [schedules]);

  const visibleSchedules = useMemo(() => {
    if (!selectedSubject) return trainerSchedules;
    return trainerSchedules.filter((schedule) =>
      scheduleMatchesSubject(schedule, selectedSubject, selectedTrainer)
    );
  }, [trainerSchedules, selectedSubject, selectedTrainer]);

  const showTimingsInCells = useMemo(
    () => shouldShowTimingsInCells(trainerSubjects, selectedSubject),
    [trainerSubjects, selectedSubject]
  );

  const fixedSlots = useMemo(() => {
    if (showTimingsInCells) return null;
    if (editMode || selectedSubject) {
      return buildFixedSlotsForSubject(selectedSubject);
    }
    return null;
  }, [editMode, selectedSubject, showTimingsInCells]);

  const subjectLabel = useMemo(() => {
    if (selectedSubject) {
      return `${selectedSubject.name} (${selectedSubject.code})`;
    }

    if (trainerSubjects.length > 1) {
      return 'All subjects';
    }

    const codes = [
      ...new Set(
        trainerSchedules
          .map((schedule) => getEffectiveSubjectCode(schedule, selectedTrainer))
          .filter(Boolean)
      ),
    ];
    if (codes.length > 1) {
      return 'All subjects';
    }
    if (codes.length === 1 && codes[0] === '22CS102033') {
      return 'Industry Data Structures and Algorithms (22CS102033)';
    }
    if (codes.length === 1 && codes[0] === '22CS102037') {
      return 'Python Essentials and Data Handling (22CS102037)';
    }
    if (codes.length === 1 && codes[0] === '25CA202009') {
      return 'Data Structures and Algorithms with Python (25CA202009)';
    }
    if (codes.length === 1) {
      const matched = trainerSubjects.find((subject) => subject.code === codes[0]);
      return matched ? `${matched.name} (${matched.code})` : codes[0];
    }
    return '';
  }, [trainerSchedules, selectedSubject, trainerSubjects]);

  const trainerLabel = (trainer) =>
    trainer.name && trainer.name !== trainer.employeeId
      ? `${trainer.name} (${trainer.employeeId})`
      : trainer.employeeId;

  const handleTrainerChange = (employeeId) => {
    setSelectedTrainer(employeeId);
    setSlotModal(null);
  };

  const handleAddSubject = () => {
    if (!trainerSubjects.length) {
      setError('No subjects are assigned to this trainer. Add subjects under Subjects first.');
      return;
    }
    if (trainerSubjects.length === 1) {
      setSelectedSubjectId(trainerSubjects[0]._id);
      setEditMode(true);
      return;
    }
    setEditMode(true);
  };

  const handleCellClick = ({ schedule, day, slot }) => {
    if (!canEdit || !editMode) return;

    if (!selectedSubject && !schedule) {
      setError('Select a subject before adding timetable slots.');
      return;
    }

    setSlotModal({
      schedule,
      day,
      slot,
      subject: selectedSubject || trainerSubjects.find((item) => item.code === schedule?.subjectCode),
    });
  };

  const handleSlotModalClose = async (saved) => {
    setSlotModal(null);
    if (saved) {
      setSuccess('Timetable updated successfully.');
      await fetchSchedules(selectedTrainer);
    }
  };

  return (
    <>
      <Topbar title="Timetable — III Semester" />
      <AlertMessage message={error} onClose={() => setError('')} />
      <AlertMessage message={success} type="success" onClose={() => setSuccess('')} />

      <p className="text-muted mb-3">
        Trainer-wise weekly timetable. Select a trainer to view their schedule.
        {canEdit && ' Turn on edit mode to add or modify slots by subject.'}
      </p>

      {loading ? (
        <LoadingSpinner message="Loading timetable..." />
      ) : (
        <>
          <div className="row g-3 mb-4 align-items-end">
            <div className="col-md-4">
              <label htmlFor="trainer-select" className="form-label fw-semibold">
                Trainer
              </label>
              <select
                id="trainer-select"
                className="form-select"
                value={selectedTrainer}
                onChange={(e) => handleTrainerChange(e.target.value)}
              >
                {trainerOptions.map((trainer) => (
                  <option key={trainer.employeeId} value={trainer.employeeId}>
                    {trainerLabel(trainer)}
                  </option>
                ))}
              </select>
            </div>

            {canEdit && (
              <div className="col-md-4">
                <label htmlFor="subject-select" className="form-label fw-semibold">
                  Subject
                </label>
                <select
                  id="subject-select"
                  className="form-select"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  disabled={subjectsLoading}
                >
                  <option value="">All subjects</option>
                  {trainerSubjects.map((subject) => (
                    <option key={subject._id} value={subject._id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {canEdit && (
              <div className="col-md-4 d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn ${editMode ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => setEditMode((current) => !current)}
                >
                  {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleAddSubject}
                  disabled={!selectedTrainer || subjectsLoading}
                >
                  Add Subject to Timetable
                </button>
              </div>
            )}
          </div>

          {selectedTrainer && (
            <div className="mb-3">
              <h5 className="mb-0">{trainerNameByCode[selectedTrainer] || selectedTrainer}</h5>
              <small className="text-muted d-block">{selectedTrainer}</small>
              {subjectLabel && (
                <small className="text-success d-block mt-1">{subjectLabel}</small>
              )}
              <small className="text-muted d-block mt-1">
                {visibleSchedules.length} class slot{visibleSchedules.length === 1 ? '' : 's'}
                {selectedSubject ? ` for ${selectedSubject.code}` : ' this week'}
              </small>
              {editMode && !showTimingsInCells && (
                <small className="text-primary d-block mt-1">
                  Click a cell to add or edit a slot. S1, S2, and S3 times come from the selected subject.
                </small>
              )}
              {editMode && showTimingsInCells && (
                <small className="text-primary d-block mt-1">
                  This trainer has subjects with different period timings. Select a subject to edit slots, or view times in each cell below.
                </small>
              )}
              {!editMode && showTimingsInCells && (
                <small className="text-muted d-block mt-1">
                  Period timings vary by subject and are shown in each cell.
                </small>
              )}
            </div>
          )}

          <TrainerTimetableGrid
            schedules={visibleSchedules}
            trainerCode={selectedTrainer}
            subjectLabel={subjectLabel}
            fixedSlots={fixedSlots}
            editMode={canEdit && editMode}
            showSubjectInCells={!selectedSubject}
            showTimingsInCells={showTimingsInCells}
            onCellClick={handleCellClick}
          />

          {slotModal && (
            <TimetableSlotModal
              schedule={slotModal.schedule}
              trainerCode={selectedTrainer}
              day={slotModal.day}
              slot={slotModal.slot}
              subject={slotModal.subject}
              subjects={trainerSubjects}
              onClose={handleSlotModalClose}
            />
          )}
        </>
      )}
    </>
  );
};

export default Timetable;
