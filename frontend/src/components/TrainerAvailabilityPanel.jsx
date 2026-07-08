import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getTrainerAvailability } from '../services/replacementService.js';
import { getTrainers } from '../services/trainerService.js';
import { getSubjects } from '../services/subjectService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';
import { availabilityToEvents, formatWeekRangeLabel, toInputDate } from '../utils/availabilityUtils.js';
import { formatTimeRange } from '../utils/scheduleUtils.js';
import { ChevronLeftIcon, ChevronRightIcon } from './icons.jsx';
import '../styles/availability-calendar.css';

const ALL_TRAINERS = '';
const ALL_SUBJECTS = '';
const DEFAULT_SLOT_START = '09:00';
const DEFAULT_SLOT_END = '17:00';

const getMonday = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getSunday = (monday) => {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
};

const toCalendarTime = (time) => `${time}:00`;

const TrainerAvailabilityPanel = () => {
  const calendarRef = useRef(null);
  const [trainers, setTrainers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState(ALL_TRAINERS);
  const [selectedSubjectId, setSelectedSubjectId] = useState(ALL_SUBJECTS);
  const [slotStart, setSlotStart] = useState(DEFAULT_SLOT_START);
  const [slotEnd, setSlotEnd] = useState(DEFAULT_SLOT_END);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getMonday());

  const weekEnd = useMemo(() => getSunday(weekStart), [weekStart]);

  useEffect(() => {
    Promise.all([
      getTrainers({ limit: 200, status: 'active', sortBy: 'name', sortOrder: 'asc' }),
      getSubjects({ limit: 200, sortBy: 'name', sortOrder: 'asc' }),
    ])
      .then(([trainerData, subjectData]) => {
        setTrainers(trainerData.trainers || []);
        setSubjects(subjectData.subjects || []);
      })
      .catch((err) => showError(getErrorMessage(err)));
  }, []);

  const fetchAvailability = useCallback(async (start, end, filters) => {
    setLoading(true);
    try {
      const params = {
        start: toInputDate(start),
        end: toInputDate(end),
        slotStart: filters.slotStart,
        slotEnd: filters.slotEnd,
      };
      if (filters.trainerId) params.trainerId = filters.trainerId;
      if (filters.subjectId) params.subjectId = filters.subjectId;
      const data = await getTrainerAvailability(params);
      setAvailabilityData(data);
    } catch (err) {
      showError(getErrorMessage(err));
      setAvailabilityData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability(weekStart, weekEnd, {
      trainerId: selectedTrainerId || undefined,
      subjectId: selectedSubjectId || undefined,
      slotStart,
      slotEnd,
    });
  }, [weekStart, weekEnd, selectedTrainerId, selectedSubjectId, slotStart, slotEnd, fetchAvailability]);

  useEffect(() => {
    const api = calendarRef.current?.getApi?.();
    if (!api || !selectedTrainerId) return;
    const current = getMonday(api.getDate());
    if (current.getTime() !== weekStart.getTime()) {
      api.gotoDate(weekStart);
    }
  }, [weekStart, selectedTrainerId]);

  const shiftWeek = (offset) => {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + offset * 7);
      return getMonday(next);
    });
  };

  const handleDatesSet = useCallback((info) => {
    const monday = getMonday(info.start);
    setWeekStart((current) => (
      current.getTime() === monday.getTime() ? current : monday
    ));
  }, []);

  const displaySlotStart = availabilityData?.filterStart || slotStart;
  const displaySlotEnd = availabilityData?.filterEnd || slotEnd;

  const selectedTrainerAvailability = useMemo(() => {
    if (!availabilityData?.trainers?.length || !selectedTrainerId) return [];
    const trainer = availabilityData.trainers.find((item) => item._id === selectedTrainerId);
    return trainer?.availability || [];
  }, [availabilityData, selectedTrainerId]);

  const calendarEvents = useMemo(
    () => availabilityToEvents(selectedTrainerAvailability),
    [selectedTrainerAvailability]
  );

  const weekDays = useMemo(() => {
    if (!availabilityData?.trainers?.[0]?.availability) return [];
    return availabilityData.trainers[0].availability.map((day) => ({
      date: day.date,
      day: day.day,
      label: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
      }),
    }));
  }, [availabilityData]);

  return (
    <div className="trainer-availability-panel">
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label" htmlFor="availability-trainer-select">Trainer</label>
          <select
            id="availability-trainer-select"
            className="form-select"
            value={selectedTrainerId}
            onChange={(e) => setSelectedTrainerId(e.target.value)}
          >
            <option value={ALL_TRAINERS}>All trainers (overview)</option>
            {trainers.map((trainer) => (
              <option key={trainer._id} value={trainer._id}>
                {trainer.name} ({trainer.employeeId})
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="availability-subject-select">Subject</label>
          <select
            id="availability-subject-select"
            className="form-select"
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
          >
            <option value={ALL_SUBJECTS}>All subjects</option>
            {subjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name} ({subject.code})
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label" htmlFor="availability-slot-start">Start time</label>
          <input
            id="availability-slot-start"
            type="time"
            className="form-control"
            min={DEFAULT_SLOT_START}
            max={DEFAULT_SLOT_END}
            value={slotStart}
            onChange={(e) => setSlotStart(e.target.value)}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label" htmlFor="availability-slot-end">End time</label>
          <input
            id="availability-slot-end"
            type="time"
            className="form-control"
            min={DEFAULT_SLOT_START}
            max={DEFAULT_SLOT_END}
            value={slotEnd}
            onChange={(e) => setSlotEnd(e.target.value)}
          />
        </div>
        <div className="col-12">
          <p className="text-muted small mb-0">
            Availability is shown between 9:00 AM and 5:00 PM. Classes ending at or after 4:45 PM count as busy until 5:00 PM.
            Filters include timetable classes, replacement assignments, and approved leave.
            {availabilityData?.subject ? ` Showing trainers eligible for ${availabilityData.subject.name}.` : ''}
          </p>
        </div>
      </div>

      <div className="availability-week-toolbar d-flex align-items-center justify-content-between mb-3">
        <div className="btn-group">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
            onClick={() => shiftWeek(-1)}
            disabled={loading}
            aria-label="Previous week"
          >
            <ChevronLeftIcon size={16} />
            Previous
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setWeekStart(getMonday())}
            disabled={loading}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
            onClick={() => shiftWeek(1)}
            disabled={loading}
            aria-label="Next week"
          >
            Next
            <ChevronRightIcon size={16} />
          </button>
        </div>
        <div className="fw-semibold">{formatWeekRangeLabel(weekStart, weekEnd)}</div>
      </div>

      {loading && !availabilityData ? (
        <LoadingSpinner message="Loading trainer availability..." />
      ) : selectedTrainerId ? (
        <div className="availability-calendar position-relative">
          {loading && (
            <div className="availability-calendar-overlay">
              <LoadingSpinner message="Updating availability..." />
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            initialDate={weekStart}
            firstDay={1}
            headerToolbar={false}
            events={calendarEvents}
            slotMinTime={toCalendarTime(displaySlotStart)}
            slotMaxTime={toCalendarTime(displaySlotEnd)}
            allDaySlot={false}
            height="auto"
            nowIndicator
            datesSet={handleDatesSet}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
            editable={false}
            selectable={false}
          />
        </div>
      ) : (
        <div className="card table-card position-relative">
          {loading && (
            <div className="availability-calendar-overlay">
              <LoadingSpinner message="Updating availability..." />
            </div>
          )}
          <div className="card-body table-responsive">
            <table className="table table-sm table-bordered availability-overview-table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="availability-trainer-col">Trainer</th>
                  {weekDays.map((day) => (
                    <th key={day.date} className="text-center">{day.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!availabilityData?.trainers?.length ? (
                  <tr>
                    <td colSpan={weekDays.length + 1} className="text-center text-muted py-4">
                      No trainer availability found for this week and filter selection
                    </td>
                  </tr>
                ) : (
                  availabilityData.trainers.map((trainer) => {
                    const dayMap = new Map(trainer.availability.map((day) => [day.date, day]));
                    return (
                      <tr key={trainer._id}>
                        <td className="availability-trainer-col">
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-start"
                            onClick={() => setSelectedTrainerId(trainer._id)}
                          >
                            {trainer.name}
                          </button>
                          <div className="small text-muted">{trainer.employeeId}</div>
                        </td>
                        {weekDays.map((day) => {
                          const entry = dayMap.get(day.date);
                          if (!entry) {
                            return <td key={day.date} className="text-center text-muted">—</td>;
                          }
                          if (entry.onLeave) {
                            return (
                              <td key={day.date} className="text-center">
                                <span className="badge bg-secondary">On leave</span>
                              </td>
                            );
                          }
                          if (!entry.slots?.length) {
                            return <td key={day.date} className="text-center text-muted small">Busy</td>;
                          }
                          return (
                            <td key={day.date} className="availability-slot-cell">
                              {entry.slots.map((slot) => (
                                <span key={`${slot.startTime}-${slot.endTime}`} className="availability-pill">
                                  {formatTimeRange(slot.startTime, slot.endTime)}
                                </span>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerAvailabilityPanel;
