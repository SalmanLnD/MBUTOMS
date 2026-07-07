import { useState, useEffect } from 'react';
import { createSchedule, updateSchedule } from '../services/scheduleService.js';
import { getSubjects, getSemesters } from '../services/subjectService.js';
import { getTrainers } from '../services/trainerService.js';
import { getVenues } from '../services/venueService.js';
import { getBatches } from '../services/scheduleService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';

const emptyForm = {
  date: toInputDate(new Date()),
  startTime: '09:00',
  endTime: '10:30',
  subject: '',
  trainer: '',
  venue: '',
  batch: '',
  semester: '',
  notes: '',
  status: 'scheduled',
};

const ScheduleFormModal = ({ schedule, defaultDate, onClose }) => {
  const [form, setForm] = useState(emptyForm);
  const [subjects, setSubjects] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [venues, setVenues] = useState([]);
  const [batches, setBatches] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(schedule);

  useEffect(() => {
    const loadOptions = async () => {
      const [subjRes, trainerRes, venueRes, batchData, semData] = await Promise.all([
        getSubjects({ limit: 100 }),
        getTrainers({ limit: 100 }),
        getVenues({ limit: 100, isActive: 'true' }),
        getBatches(),
        getSemesters(),
      ]);
      setSubjects(subjRes.subjects || []);
      setTrainers(trainerRes.trainers || []);
      setVenues(venueRes.venues || []);
      setBatches(batchData);
      setSemesters(semData);
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (schedule) {
      setForm({
        date: toInputDate(schedule.date),
        startTime: schedule.startTime || '09:00',
        endTime: schedule.endTime || '10:30',
        subject: schedule.subject?._id || schedule.subject || '',
        trainer: schedule.trainer?._id || schedule.trainer || '',
        venue: schedule.venue?._id || schedule.venue || '',
        batch: schedule.batch?._id || schedule.batch || '',
        semester: schedule.semester?._id || schedule.semester || '',
        notes: schedule.notes || '',
        status: schedule.status || 'scheduled',
      });
    } else if (defaultDate) {
      setForm((prev) => ({
        ...prev,
        date: toInputDate(defaultDate),
      }));
    }
  }, [schedule, defaultDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-set semester when batch is selected
      if (name === 'batch' && value) {
        const batch = batches.find((b) => b._id === value);
        if (batch?.semester) {
          updated.semester = batch.semester._id || batch.semester;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEdit) {
        await updateSchedule(schedule._id, form);
      } else {
        await createSchedule(form);
      }
      onClose(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      show
      title={isEdit ? 'Edit Class' : 'Schedule Class'}
      onClose={() => onClose(false)}
      size="toms-modal-lg"
      scrollable
    >
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Date *</label>
                  <input type="date" name="date" className="form-control" value={form.date} onChange={handleChange} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Start Time *</label>
                  <input type="time" name="startTime" className="form-control" value={form.startTime} onChange={handleChange} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">End Time *</label>
                  <input type="time" name="endTime" className="form-control" value={form.endTime} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Subject *</label>
                  <StyledSelect
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    required
                    placeholder="Select subject"
                    options={[
                      { value: '', label: 'Select subject' },
                      ...subjects.map((s) => ({
                        value: s._id,
                        label: `${s.name} (${s.code})`,
                      })),
                    ]}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Trainer *</label>
                  <StyledSelect
                    name="trainer"
                    value={form.trainer}
                    onChange={handleChange}
                    required
                    placeholder="Select trainer"
                    options={[
                      { value: '', label: 'Select trainer' },
                      ...trainers.map((t) => ({
                        value: t._id,
                        label: `${t.name} (${t.employeeId})`,
                      })),
                    ]}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Venue *</label>
                  <StyledSelect
                    name="venue"
                    value={form.venue}
                    onChange={handleChange}
                    required
                    placeholder="Select venue"
                    options={[
                      { value: '', label: 'Select venue' },
                      ...venues.map((v) => ({
                        value: v._id,
                        label: `${v.name} — ${v.building}`,
                      })),
                    ]}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Batch *</label>
                  <StyledSelect
                    name="batch"
                    value={form.batch}
                    onChange={handleChange}
                    required
                    placeholder="Select batch"
                    options={[
                      { value: '', label: 'Select batch' },
                      ...batches.map((b) => ({
                        value: b._id,
                        label: b.name,
                      })),
                    ]}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Semester *</label>
                  <StyledSelect
                    name="semester"
                    value={form.semester}
                    onChange={handleChange}
                    required
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
                {isEdit && (
                  <div className="col-md-6">
                    <label className="form-label">Status</label>
                    <StyledSelect
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      options={[
                        { value: 'scheduled', label: 'Scheduled' },
                        { value: 'cancelled', label: 'Cancelled' },
                        { value: 'completed', label: 'Completed' },
                      ]}
                    />
                  </div>
                )}
                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea name="notes" className="form-control" rows="2" value={form.notes} onChange={handleChange} />
                </div>
              </div>
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ScheduleFormModal;
