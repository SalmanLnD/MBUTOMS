import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import ActionIconButton from './ActionIconButton.jsx';
import StyledSelect from './StyledSelect.jsx';
import SearchableSelect from './SearchableSelect.jsx';
import { EditIcon, TrashIcon } from './icons.jsx';
import {
  createSpecialClass,
  updateSpecialClass,
  deleteSpecialClass,
  getSpecialClasses,
} from '../services/scheduleService.js';
import { getClasses } from '../services/classService.js';
import { getSubjects } from '../services/subjectService.js';
import { getActiveVenuesForSelect } from '../services/venueService.js';
import { getActiveSlotKeys, getSlotTimesForSubject } from '../utils/timetableSlots.js';
import { formatDate, getErrorMessage, toInputDate } from '../utils/helpers.js';

const SUBJECT_PAGE_SIZE = 200;

const loadAllSubjects = async () => {
  const subjects = [];
  for (let page = 1; page <= 20; page += 1) {
    const data = await getSubjects({ page, limit: SUBJECT_PAGE_SIZE, sortBy: 'name' });
    subjects.push(...(data.subjects || []));
    if (page >= (data.pagination?.pages || 1)) break;
  }
  return subjects;
};

const defaultTimingForSubject = (subject) => {
  const keys = subject ? getActiveSlotKeys(subject) : [];
  return keys[0] || CUSTOM_TIMING;
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL_WEEKDAYS = ['Sunday', ...WEEKDAYS];
const CUSTOM_TIMING = 'custom';

const weekdayForInputDate = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  return ALL_WEEKDAYS[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
};

const weekdaysBetween = (start, end) => {
  const [sy, sm, sd] = String(start || '').split('-').map(Number);
  const [ey, em, ed] = String(end || '').split('-').map(Number);
  if (!sy || !ey) return new Set();
  const cursor = new Date(Date.UTC(sy, sm - 1, sd, 12));
  const last = new Date(Date.UTC(ey, em - 1, ed, 12));
  const days = new Set();
  while (cursor <= last && days.size < 7) {
    days.add(ALL_WEEKDAYS[cursor.getUTCDay()]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

const trainerLabel = (trainer) =>
  trainer.name && trainer.name !== trainer.employeeId
    ? `${trainer.name} (${trainer.employeeId})`
    : trainer.employeeId;

const buildInitialForm = (initialDate) => ({
  specialType: 'one_time',
  trainerCode: '',
  subjectId: '',
  classId: '',
  timing: 'S1',
  startTime: '',
  endTime: '',
  date: initialDate,
  startDate: initialDate,
  endDate: initialDate,
  days: [weekdayForInputDate(initialDate)].filter(Boolean),
  venueId: '',
  reason: '',
  includeInRtet: true,
});

const SpecialClassModal = ({ trainers = [], initialDate, initialTab = 'add', onClose, onChanged }) => {
  const today = toInputDate(new Date());
  const [activeTab, setActiveTab] = useState(initialTab === 'list' ? 'list' : 'add');
  const [form, setForm] = useState(() => buildInitialForm(initialDate || today));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [allSubjects, setAllSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [allClasses, setAllClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [venueOptions, setVenueOptions] = useState([]);

  const [specialClasses, setSpecialClasses] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState('');

  const isRecurring = form.specialType === 'recurring';
  const selectedSubject = allSubjects.find((item) => item._id === form.subjectId) || null;

  useEffect(() => {
    let cancelled = false;
    getActiveVenuesForSelect()
      .then((venues) => {
        if (!cancelled) setVenueOptions(venues || []);
      })
      .catch(() => {
        if (!cancelled) setVenueOptions([]);
      });
    loadAllSubjects()
      .then((subjects) => {
        if (!cancelled) setAllSubjects(subjects);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false);
      });
    getClasses({ status: 'active' })
      .then((data) => {
        if (!cancelled) setAllClasses(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trainerSelectOptions = useMemo(
    () => trainers.map((trainer) => ({
      value: trainer.employeeId,
      label: trainerLabel(trainer),
      keywords: trainer.employeeId,
    })),
    [trainers]
  );

  const subjectSelectOptions = useMemo(
    () => allSubjects.map((subject) => ({
      value: subject._id,
      label: `${subject.name} (${subject.code})`,
    })),
    [allSubjects]
  );

  const classSelectOptions = useMemo(
    () => allClasses.map((cls) => ({
      value: cls._id,
      label: `${cls.department} ${cls.section} · PY ${cls.py} · Sem ${cls.currentSemester}`,
      keywords: `${cls.department}${cls.section}`,
    })),
    [allClasses]
  );

  const venueSelectOptions = useMemo(
    () => venueOptions.map((venue) => ({
      value: venue._id,
      label: `${venue.name}${venue.building ? ` · ${venue.building}` : ''}`,
    })),
    [venueOptions]
  );

  const loadSpecialClasses = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await getSpecialClasses({ from: today });
      setSpecialClasses(data.specialClasses || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setListLoading(false);
    }
  }, [today]);

  useEffect(() => {
    if (activeTab === 'list') loadSpecialClasses();
  }, [activeTab, loadSpecialClasses]);

  const availableRecurringDays = useMemo(
    () => (isRecurring ? weekdaysBetween(form.startDate, form.endDate) : new Set()),
    [isRecurring, form.startDate, form.endDate]
  );

  const timingOptions = useMemo(() => {
    const presets = selectedSubject
      ? getActiveSlotKeys(selectedSubject).map((slotKey) => {
        const times = getSlotTimesForSubject(selectedSubject, slotKey);
        return { value: slotKey, label: `${slotKey} (${times.startTime} – ${times.endTime})` };
      })
      : [];
    return [...presets, { value: CUSTOM_TIMING, label: 'Custom timing' }];
  }, [selectedSubject]);

  const resolvedTimes = useMemo(() => {
    if (form.timing === CUSTOM_TIMING || !selectedSubject) {
      return { startTime: form.startTime, endTime: form.endTime };
    }
    return getSlotTimesForSubject(selectedSubject, form.timing);
  }, [form.timing, form.startTime, form.endTime, selectedSubject]);

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleTypeChange = (specialType) => {
    setError('');
    setForm((prev) => ({
      ...prev,
      specialType,
      days: specialType === 'recurring'
        ? [weekdayForInputDate(prev.startDate)].filter(Boolean)
        : prev.days,
    }));
  };

  const handleSubjectChange = (event) => {
    const subjectId = event.target.value;
    const subject = allSubjects.find((item) => item._id === subjectId) || null;
    setForm((prev) => ({
      ...prev,
      subjectId,
      timing: prev.timing === CUSTOM_TIMING ? CUSTOM_TIMING : defaultTimingForSubject(subject),
    }));
  };

  const handleStartDateChange = (event) => {
    const startDate = event.target.value;
    setForm((prev) => {
      const endDate = prev.endDate && prev.endDate >= startDate ? prev.endDate : startDate;
      const available = weekdaysBetween(startDate, endDate);
      const days = prev.days.filter((day) => available.has(day));
      return {
        ...prev,
        startDate,
        endDate,
        days: days.length ? days : [weekdayForInputDate(startDate)].filter(Boolean),
      };
    });
  };

  const handleEndDateChange = (event) => {
    const endDate = event.target.value;
    setForm((prev) => {
      const available = weekdaysBetween(prev.startDate, endDate);
      return { ...prev, endDate, days: prev.days.filter((day) => available.has(day)) };
    });
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((item) => item !== day)
        : [...prev.days, day],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!resolvedTimes.startTime || !resolvedTimes.endTime) {
      setError('Enter the start and end time.');
      return;
    }
    if (resolvedTimes.startTime >= resolvedTimes.endTime) {
      setError('End time must be after start time.');
      return;
    }
    if (isRecurring && !form.days.length) {
      setError('Select at least one weekday.');
      return;
    }

    const payload = {
      specialType: form.specialType,
      trainerCode: form.trainerCode,
      subject: form.subjectId,
      classId: form.classId,
      slot: form.timing === CUSTOM_TIMING ? '' : form.timing,
      startTime: resolvedTimes.startTime,
      endTime: resolvedTimes.endTime,
      venue: form.venueId || null,
      reason: form.reason.trim(),
      includeInRtet: form.includeInRtet,
      ...(isRecurring
        ? { startDate: form.startDate, endDate: form.endDate, days: form.days }
        : { date: form.date }),
    };

    setSaving(true);
    try {
      if (editingGroupId) {
        await updateSpecialClass(editingGroupId, payload);
      } else {
        await createSpecialClass(payload);
      }
      await onChanged?.(isRecurring ? form.startDate : form.date);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setError('');
    try {
      await deleteSpecialClass(pendingDelete.specialGroupId);
      setPendingDelete(null);
      await loadSpecialClasses();
      await onChanged?.();
    } catch (err) {
      setPendingDelete(null);
      setError(getErrorMessage(err));
    }
  };

  const describeDates = (item) => (
    item.specialType === 'one_time' || item.startDate === item.endDate
      ? formatDate(item.startDate)
      : `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`
  );

  const startEdit = (item) => {
    const subject = allSubjects.find((entry) => (
      entry._id === item.subjectId || entry.code === item.subjectCode
    )) || null;
    const classId = item.classId
      || allClasses.find((cls) => (
        cls.department === item.department
        && cls.section === item.section
        && cls.currentSemester === item.semester
      ))?._id
      || '';
    let timing = CUSTOM_TIMING;
    if (subject) {
      const slotKeys = getActiveSlotKeys(subject);
      const matchingSlot = (item.slot && slotKeys.includes(item.slot) ? item.slot : null)
        || slotKeys.find((slotKey) => {
          const times = getSlotTimesForSubject(subject, slotKey);
          return times.startTime === item.startTime && times.endTime === item.endTime;
        });
      if (matchingSlot) timing = matchingSlot;
    }
    setForm({
      specialType: item.specialType === 'recurring' ? 'recurring' : 'one_time',
      trainerCode: item.trainerCode || '',
      subjectId: subject?._id || item.subjectId || '',
      classId,
      timing,
      startTime: item.startTime || '',
      endTime: item.endTime || '',
      date: item.startDate || today,
      startDate: item.startDate || today,
      endDate: item.endDate || item.startDate || today,
      days: item.specialType === 'recurring'
        ? [...(item.days || [])]
        : [weekdayForInputDate(item.startDate)].filter(Boolean),
      venueId: item.venueId || '',
      reason: item.reason || '',
      includeInRtet: item.includeInRtet !== false,
    });
    setEditingGroupId(item.specialGroupId);
    setError('');
    setActiveTab('add');
  };

  const cancelEdit = () => {
    setEditingGroupId('');
    setForm(buildInitialForm(initialDate || today));
  };

  return (
    <>
      <Modal show title="Special Classes" onClose={onClose} size="toms-modal-lg" scrollable>
        <div className="toms-modal-body">
          <ul className="nav nav-tabs mb-3" role="tablist">
            {[
              { id: 'add', label: editingGroupId ? 'Edit special class' : 'Add special class' },
              { id: 'list', label: 'Upcoming special classes' },
            ].map((tab) => (
              <li className="nav-item" key={tab.id} role="presentation">
                <button
                  type="button"
                  role="tab"
                  className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                  aria-selected={activeTab === tab.id}
                  onClick={() => {
                    setError('');
                    setActiveTab(tab.id);
                  }}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>

          {error && <div className="alert alert-danger">{error}</div>}

          {activeTab === 'add' && (
            <form id="special-class-form" onSubmit={handleSubmit}>
              <fieldset className="mb-3">
                <legend className="form-label fw-semibold fs-6">Is this a one-time or recurring class?</legend>
                <div className="btn-group" role="radiogroup" aria-label="Special class type">
                  {[
                    { value: 'one_time', label: 'One-time' },
                    { value: 'recurring', label: 'Recurring' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={form.specialType === option.value}
                      className={`btn ${form.specialType === option.value ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => handleTypeChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="row g-3">
                {isRecurring ? (
                  <>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="special-start-date">From date *</label>
                      <input
                        id="special-start-date"
                        type="date"
                        className="form-control"
                        value={form.startDate}
                        onChange={handleStartDateChange}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="special-end-date">To date *</label>
                      <input
                        id="special-end-date"
                        type="date"
                        className="form-control"
                        value={form.endDate}
                        min={form.startDate}
                        onChange={handleEndDateChange}
                        required
                      />
                    </div>
                    <div className="col-12">
                      <span className="form-label d-block">Repeats on *</span>
                      <div className="d-flex flex-wrap gap-2" role="group" aria-label="Repeat weekdays">
                        {WEEKDAYS.map((day) => {
                          const available = availableRecurringDays.has(day);
                          const active = form.days.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
                              aria-pressed={active}
                              disabled={!available}
                              onClick={() => toggleDay(day)}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="special-date">Date *</label>
                    <input
                      id="special-date"
                      type="date"
                      className="form-control"
                      value={form.date}
                      onChange={(event) => updateForm({ date: event.target.value })}
                      required
                    />
                    {form.date && (
                      <small className="text-muted">{weekdayForInputDate(form.date)}</small>
                    )}
                  </div>
                )}

                <div className="col-md-6">
                  <label className="form-label" htmlFor="special-trainer">Trainer *</label>
                  <SearchableSelect
                    id="special-trainer"
                    value={form.trainerCode}
                    onChange={(event) => updateForm({ trainerCode: event.target.value })}
                    required
                    placeholder="Type trainer name or ID"
                    emptyMessage="No trainer matches"
                    options={trainerSelectOptions}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="special-subject">Subject *</label>
                  <SearchableSelect
                    id="special-subject"
                    value={form.subjectId}
                    onChange={handleSubjectChange}
                    required
                    disabled={subjectsLoading}
                    placeholder={subjectsLoading ? 'Loading subjects...' : 'Type subject name or code'}
                    emptyMessage="No subject matches"
                    options={subjectSelectOptions}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label" htmlFor="special-class">Class *</label>
                  <SearchableSelect
                    id="special-class"
                    value={form.classId}
                    onChange={(event) => updateForm({ classId: event.target.value })}
                    required
                    disabled={classesLoading}
                    placeholder={classesLoading ? 'Loading classes...' : 'Type department, section or semester'}
                    emptyMessage="No class matches"
                    options={classSelectOptions}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="special-timing">Timing *</label>
                  <StyledSelect
                    id="special-timing"
                    value={form.timing}
                    onChange={(event) => {
                      const timing = event.target.value;
                      if (timing === CUSTOM_TIMING) {
                        updateForm({ timing, ...resolvedTimes });
                      } else {
                        updateForm({ timing });
                      }
                    }}
                    required
                    disabled={!form.subjectId}
                    options={timingOptions}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" htmlFor="special-start-time">Start time</label>
                  <input
                    id="special-start-time"
                    type="time"
                    className="form-control"
                    value={resolvedTimes.startTime || ''}
                    readOnly={form.timing !== CUSTOM_TIMING}
                    onChange={(event) => updateForm({ startTime: event.target.value })}
                    required
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" htmlFor="special-end-time">End time</label>
                  <input
                    id="special-end-time"
                    type="time"
                    className="form-control"
                    value={resolvedTimes.endTime || ''}
                    readOnly={form.timing !== CUSTOM_TIMING}
                    onChange={(event) => updateForm({ endTime: event.target.value })}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="special-venue">Venue</label>
                  <SearchableSelect
                    id="special-venue"
                    value={form.venueId}
                    onChange={(event) => updateForm({ venueId: event.target.value })}
                    placeholder="Type venue name (optional)"
                    emptyMessage="No venue matches"
                    options={[{ value: '', label: 'No venue assigned' }, ...venueSelectOptions]}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="special-reason">Reason / note</label>
                  <input
                    id="special-reason"
                    type="text"
                    className="form-control"
                    maxLength={200}
                    value={form.reason}
                    onChange={(event) => updateForm({ reason: event.target.value })}
                    placeholder="e.g. Extra class before mid exam"
                  />
                </div>
                <div className="col-12">
                  <fieldset>
                    <legend className="form-label fw-semibold fs-6">Include in RTET?</legend>
                    <div className="btn-group" role="radiogroup" aria-label="Include in RTET">
                      {[
                        { value: true, label: 'Include in RTET' },
                        { value: false, label: 'Exclude from RTET' },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          role="radio"
                          aria-checked={form.includeInRtet === option.value}
                          className={`btn ${form.includeInRtet === option.value ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => updateForm({ includeInRtet: option.value })}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <small className="text-muted d-block mt-1">
                      Complementary classes can be excluded from RTET. Trainer load and attendance still count.
                    </small>
                  </fieldset>
                </div>
              </div>

              <p className="text-muted small mt-3 mb-0">
                Special classes count toward trainer class hours, attendance and the topic
                tracker only on the dates they run. RTET includes them only when that option is on.
              </p>
            </form>
          )}

          {activeTab === 'list' && (
            listLoading ? (
              <div className="text-muted py-3">Loading special classes...</div>
            ) : specialClasses.length === 0 ? (
              <div className="text-muted py-3">No upcoming special classes.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Time</th>
                      <th>Trainer</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>RTET</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {specialClasses.map((item) => (
                      <tr key={item.specialGroupId}>
                        <td>{item.specialType === 'recurring' ? 'Recurring' : 'One-time'}</td>
                        <td>{describeDates(item)}</td>
                        <td>{item.days.map((day) => day.slice(0, 3)).join(', ')}</td>
                        <td>{item.startTime} – {item.endTime}</td>
                        <td>{item.trainerName}</td>
                        <td>{item.department} {item.section}</td>
                        <td>{item.subjectCode}</td>
                        <td>{item.includeInRtet === false ? 'Excluded' : 'Included'}</td>
                        <td className="text-end text-nowrap">
                          <div className="btn-group btn-group-sm action-btn-group d-inline-flex">
                            <ActionIconButton
                              variant="edit"
                              icon={EditIcon}
                              title="Edit special class"
                              aria-label={`Edit special class for ${item.trainerName}`}
                              onClick={() => startEdit(item)}
                            />
                            <ActionIconButton
                              variant="delete"
                              icon={TrashIcon}
                              title="Delete special class"
                              aria-label={`Delete special class for ${item.trainerName}`}
                              onClick={() => setPendingDelete(item)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        <div className="toms-modal-footer d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {activeTab === 'add' && (
            <>
              {editingGroupId && (
                <button type="button" className="btn btn-outline-secondary" onClick={cancelEdit}>
                  Cancel edit
                </button>
              )}
              <button type="submit" form="special-class-form" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editingGroupId ? 'Save changes' : 'Add special class'}
              </button>
            </>
          )}
        </div>
      </Modal>

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Special Class"
          message={`Remove the special class for ${pendingDelete.trainerName} (${pendingDelete.department} ${pendingDelete.section}, ${describeDates(pendingDelete)})? Trainer hours and attendance will update${pendingDelete.includeInRtet === false ? '' : ', along with RTET'}.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default SpecialClassModal;
