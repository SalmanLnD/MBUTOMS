import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  createSubject,
  updateSubject,
  getSemesters,
  getDepartments,
  getSchools,
  getSubjects,
} from '../services/subjectService.js';
import { getTrainers } from '../services/trainerService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';
import { SLOT_FIELD_KEYS, groupSubjectsBySlotTimings, findSubjectsWithSimilarTimings, formatSlotTimingsSummary, normalizeSlotTimings, areSlotTimingsEqual } from '../utils/timetableSlots.js';
import { getSubjectSlotProfile } from '../utils/subjectSlotTimings.js';

const emptyForm = {
  name: '',
  code: '',
  oifNumber: '',
  dealNumber: '',
  startDate: '',
  academicYear: '2026-27',
  schools: [],
  semester: '',
  departments: [],
  allDepartments: false,
  hours: 0,
  trainerEligible: [],
  slotCount: 4,
  slotTimings: normalizeSlotTimings(),
};

const toId = (value) => value?._id || value || '';

const SubjectFormModal = ({ subject, onClose, onManageResource }) => {
  const [form, setForm] = useState(emptyForm);
  const [schools, setSchools] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [timingSourceSubjectId, setTimingSourceSubjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState('');
  const isEdit = Boolean(subject);

  const loadDepartments = useCallback(async (schoolIds, selectedDepartments = []) => {
    if (!schoolIds.length) {
      setDepartments([]);
      return [];
    }
    const deptData = await getDepartments({ schools: schoolIds.join(',') });
    setDepartments(deptData);
    const validIds = new Set(deptData.map((d) => d._id));
    return selectedDepartments.filter((id) => validIds.has(id));
  }, []);

  useEffect(() => {
    const loadOptions = async () => {
      setOptionsLoading(true);
      setError('');
      try {
        const [schoolData, semData, trainerData, subjectData] = await Promise.all([
          getSchools(),
          getSemesters(),
          getTrainers({ limit: 100 }),
          getSubjects({ limit: 50 }),
        ]);
        setSchools(schoolData);
        setSemesters(semData);
        setTrainers(trainerData.trainers || []);
        setAllSubjects(subjectData.subjects || []);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setOptionsLoading(false);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (!subject) {
      setForm(emptyForm);
      setDepartments([]);
      setTimingSourceSubjectId('');
      return;
    }

    const schoolIds = (subject.schools?.length
      ? subject.schools
      : subject.school
        ? [subject.school]
        : []
    ).map(toId);

    const departmentIds = (subject.departments?.length
      ? subject.departments
      : subject.department
        ? [subject.department]
        : []
    ).map(toId);

    setForm({
      name: subject.name || '',
      code: subject.code || '',
      oifNumber: subject.oifNumber || '',
      dealNumber: subject.dealNumber || '',
      startDate: subject.startDate ? toInputDate(subject.startDate) : '',
      academicYear: subject.academicYear || '2026-27',
      schools: schoolIds,
      semester: toId(subject.semester),
      departments: departmentIds,
      allDepartments: Boolean(subject.allDepartments),
      hours: subject.hours || 0,
      trainerEligible: subject.trainerEligible?.map((t) => toId(t)) || [],
      slotCount: subject.slotCount || getSubjectSlotProfile(subject.code)?.slotCount || 4,
      slotTimings: normalizeSlotTimings(subject.slotTimings),
    });

    if (schoolIds.length) {
      loadDepartments(schoolIds, departmentIds).catch((err) => setError(getErrorMessage(err)));
    }
  }, [subject, loadDepartments]);

  const timingGroups = useMemo(
    () => groupSubjectsBySlotTimings(allSubjects, subject?._id),
    [allSubjects, subject?._id]
  );

  const similarSubjects = useMemo(
    () => findSubjectsWithSimilarTimings(allSubjects, form.slotTimings, subject?._id, form.slotCount),
    [allSubjects, form.slotTimings, form.slotCount, subject?._id]
  );

  const handleTimingSourceChange = (e) => {
    const subjectId = e.target.value;
    setTimingSourceSubjectId(subjectId);
    if (!subjectId) return;

    const sourceSubject = allSubjects.find((item) => item._id === subjectId);
    if (!sourceSubject) return;

    setForm((prev) => ({
      ...prev,
      slotTimings: normalizeSlotTimings(sourceSubject.slotTimings),
    }));
  };

  const handleSchoolsChange = async (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setForm((prev) => ({ ...prev, schools: selected, departments: [], allDepartments: false }));
    try {
      await loadDepartments(selected);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDepartmentsChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setForm((prev) => ({ ...prev, departments: selected, allDepartments: false }));
  };

  const handleAllDepartmentsChange = (e) => {
    const checked = e.target.checked;
    setForm((prev) => ({
      ...prev,
      allDepartments: checked,
      departments: checked ? [] : prev.departments,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTrainerChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setForm((prev) => ({ ...prev, trainerEligible: selected }));
  };

  const handleSlotTimingChange = (slotKey, field, value) => {
    setForm((prev) => {
      const nextSlotTimings = {
        ...prev.slotTimings,
        [slotKey]: {
          ...prev.slotTimings[slotKey],
          [field]: value,
        },
      };

      if (timingSourceSubjectId) {
        const sourceSubject = allSubjects.find((item) => item._id === timingSourceSubjectId);
        if (sourceSubject && !areSlotTimingsEqual(sourceSubject.slotTimings, nextSlotTimings)) {
          setTimingSourceSubjectId('');
        }
      }

      return {
        ...prev,
        slotTimings: nextSlotTimings,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      name: form.name,
      code: form.code,
      oifNumber: form.oifNumber,
      dealNumber: form.dealNumber,
      startDate: form.startDate,
      schools: form.schools,
      semester: form.semester || undefined,
      departments: form.allDepartments ? [] : form.departments,
      allDepartments: form.allDepartments,
      hours: Number(form.hours),
      trainerEligible: form.trainerEligible,
      slotCount: Number(form.slotCount) || 4,
      slotTimings: form.slotTimings,
    };

    try {
      if (isEdit) {
        await updateSubject(subject._id, payload);
      } else {
        await createSubject(payload);
      }
      onClose(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedSchools = schools.filter((s) => form.schools.includes(s._id));

  return (
    <Modal
      show
      title={isEdit ? 'Edit Subject' : 'Add Subject'}
      onClose={() => onClose(false)}
      size="toms-modal-lg"
      scrollable
    >
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {optionsLoading ? (
            <p className="text-muted mb-0">Loading form options...</p>
          ) : (
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Subject Name *</label>
                <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Subject Code *</label>
                <input name="code" className="form-control" value={form.code} onChange={handleChange} required />
              </div>
              <div className="col-md-4">
                <label className="form-label">OIF Number *</label>
                <input name="oifNumber" className="form-control" value={form.oifNumber} onChange={handleChange} required />
              </div>
              <div className="col-md-4">
                <label className="form-label">Deal Number *</label>
                <input name="dealNumber" className="form-control" value={form.dealNumber} onChange={handleChange} required />
              </div>
              <div className="col-md-4">
                <label className="form-label">Start Date *</label>
                <input type="date" name="startDate" className="form-control" value={form.startDate} onChange={handleChange} required />
              </div>
              <div className="col-md-4">
                <label className="form-label">Academic Year *</label>
                <input
                  name="academicYear"
                  className="form-control"
                  value={form.academicYear}
                  onChange={handleChange}
                  placeholder="2026-27"
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Schools</label>
                <select
                  multiple
                  className="form-select"
                  value={form.schools}
                  onChange={handleSchoolsChange}
                  size={Math.min(4, Math.max(3, schools.length))}
                >
                  {schools.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                <small className="text-muted">Hold Ctrl/Cmd to select multiple schools</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Semester</label>
                <StyledSelect
                  name="semester"
                  value={form.semester}
                  onChange={handleChange}
                  placeholder="Select semester"
                  options={[
                    { value: '', label: 'Select semester' },
                    ...semesters.map((s) => ({
                      value: s._id,
                      label: s.name,
                    })),
                  ]}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Departments</label>
                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="all-departments"
                    checked={form.allDepartments}
                    onChange={handleAllDepartmentsChange}
                    disabled={!form.schools.length}
                  />
                  <label className="form-check-label" htmlFor="all-departments">
                    All departments in selected schools
                  </label>
                </div>
                <select
                  multiple
                  className="form-select"
                  value={form.departments}
                  onChange={handleDepartmentsChange}
                  disabled={!form.schools.length || form.allDepartments}
                  size={Math.min(8, Math.max(4, departments.length + 1))}
                >
                  {selectedSchools.map((school) => {
                    const schoolDepts = departments.filter((d) => toId(d.school) === school._id);
                    if (!schoolDepts.length) return null;
                    return (
                      <optgroup key={school._id} label={`${school.code} — ${school.name}`}>
                        {schoolDepts.map((d) => (
                          <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <small className="text-muted">
                  {form.schools.length
                    ? 'Departments are grouped by selected school. Hold Ctrl/Cmd to select multiple.'
                    : 'Select one or more schools first'}
                </small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Hours per Week</label>
                <input type="number" name="hours" className="form-control" min="0" value={form.hours} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Trainer Eligible</label>
                <select multiple className="form-select" value={form.trainerEligible} onChange={handleTrainerChange} size="4">
                  {trainers.map((t) => (
                    <option key={t._id} value={t._id}>{t.name} ({t.employeeId})</option>
                  ))}
                </select>
                <small className="text-muted">Hold Ctrl/Cmd to select multiple</small>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="slot-count">Number of periods</label>
                <StyledSelect
                  id="slot-count"
                  name="slotCount"
                  value={String(form.slotCount)}
                  onChange={handleChange}
                  options={[
                    { value: '3', label: '3 periods (S1–S3)' },
                    { value: '4', label: '4 periods (S1–S4)' },
                  ]}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Period Timings (S1–S{form.slotCount})</label>
                <div className="border rounded p-3 mb-3 bg-light">
                  <div className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="use-similar-timings"
                      checked={Boolean(timingSourceSubjectId)}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setTimingSourceSubjectId('');
                        }
                      }}
                      disabled={!timingGroups.length}
                    />
                    <label className="form-check-label" htmlFor="use-similar-timings">
                      Use timings from a subject with similar slots
                    </label>
                  </div>
                  {timingGroups.length > 0 ? (
                    <div className="mb-0">
                      <label className="form-label small" htmlFor="timing-source-subject">
                        Copy timings from subject
                      </label>
                      <StyledSelect
                        id="timing-source-subject"
                        value={timingSourceSubjectId}
                        onChange={handleTimingSourceChange}
                        placeholder="Enter timings manually"
                        options={[{ value: '', label: 'Enter timings manually' }]}
                        groups={timingGroups.map((group) => ({
                          label: `${group.summary} (${group.subjects.length} subject${group.subjects.length === 1 ? '' : 's'})`,
                          options: group.subjects.map((item) => ({
                            value: item._id,
                            label: `${item.name} (${item.code})`,
                          })),
                        }))}
                      />
                      <small className="text-muted d-block mt-2">
                        Subjects are grouped by matching S1–S4 timings. Select one to copy its slots.
                      </small>
                    </div>
                  ) : (
                    <small className="text-muted d-block">
                      No other subjects available yet. Enter timings manually below.
                    </small>
                  )}
                </div>
                <div className="row g-3">
                  {SLOT_FIELD_KEYS.slice(0, form.slotCount).map((slotKey) => (
                    <div className="col-md-6 col-lg-3" key={slotKey}>
                      <div className="border rounded p-3 h-100">
                        <div className="fw-semibold text-uppercase mb-2">{slotKey}</div>
                        <label className="form-label small mb-1" htmlFor={`${slotKey}-start`}>Start</label>
                        <input
                          id={`${slotKey}-start`}
                          type="time"
                          className="form-control mb-2"
                          value={form.slotTimings[slotKey].startTime}
                          onChange={(e) => handleSlotTimingChange(slotKey, 'startTime', e.target.value)}
                          required
                        />
                        <label className="form-label small mb-1" htmlFor={`${slotKey}-end`}>End</label>
                        <input
                          id={`${slotKey}-end`}
                          type="time"
                          className="form-control"
                          value={form.slotTimings[slotKey].endTime}
                          onChange={(e) => handleSlotTimingChange(slotKey, 'endTime', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {similarSubjects.length > 0 && (
                  <small className="text-success d-block mt-2">
                    {similarSubjects.length} other subject{similarSubjects.length === 1 ? '' : 's'} use these timings:
                    {' '}
                    {similarSubjects.map((item) => `${item.name} (${item.code})`).join(', ')}
                  </small>
                )}
                <small className="text-muted d-block mt-2">
                  Current timings: {formatSlotTimingsSummary(form.slotTimings, form.slotCount)}. These are used when adding this subject to a trainer timetable.
                </small>
              </div>
              {isEdit && onManageResource && (
                <div className="col-12">
                  <label className="form-label">Resources</label>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => onManageResource('syllabus')}
                    >
                      {subject?.syllabusUrl ? 'Update Syllabus' : 'Add Syllabus'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => onManageResource('cho')}
                    >
                      {subject?.choUrl ? 'Update CHO' : 'Add CHO'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => onManageResource('practicePortal')}
                    >
                      {subject?.practicePortalUrl ? 'Update Practice Portal' : 'Add Practice Portal'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading || optionsLoading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SubjectFormModal;
