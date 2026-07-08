import { useState, useEffect } from 'react';
import {
  createTrainer,
  updateTrainer,
  getDepartments,
} from '../services/trainerService.js';
import { getSubjects } from '../services/subjectService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';

const toSubjectId = (subject) => {
  if (!subject) return '';
  if (typeof subject === 'string') return subject;
  const id = subject._id ?? subject;
  return typeof id === 'string' ? id : id?.toString?.() || '';
};

const emptyForm = {
  employeeId: '',
  name: '',
  email: '',
  phone: '',
  camuErpId: '',
  camuPassword: '',
  department: '',
  subjects: [],
  skills: '',
  experience: 0,
  joiningDate: toInputDate(new Date()),
  status: 'active',
  weeklyWorkloadHours: 0,
  performanceScore: 0,
};

const TrainerFormModal = ({ trainer, onClose }) => {
  const [form, setForm] = useState(emptyForm);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(trainer);

  useEffect(() => {
    const loadOptions = async () => {
      const [depts, subjData] = await Promise.all([
        getDepartments(),
        getSubjects({ limit: 100 }),
      ]);
      setDepartments(depts);
      setSubjects(subjData.subjects || subjData);
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (trainer) {
      setForm({
        employeeId: trainer.employeeId || '',
        name: trainer.name || '',
        email: trainer.email || '',
        phone: trainer.phone || '',
        camuErpId: trainer.camuErpId || '',
        camuPassword: trainer.camuPassword || '',
        department: trainer.department?._id || trainer.department || '',
        subjects: trainer.subjects?.map(toSubjectId).filter(Boolean) || [],
        skills: trainer.skills?.join(', ') || '',
        experience: trainer.experience || 0,
        joiningDate: trainer.joiningDate
          ? new Date(trainer.joiningDate).toISOString().split('T')[0]
          : '',
        status: trainer.status || 'active',
        weeklyWorkloadHours: trainer.weeklyWorkloadHours || 0,
        performanceScore: trainer.performanceScore || 0,
      });
    }
  }, [trainer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubjectChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setForm((prev) => ({ ...prev, subjects: selected }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      ...form,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      experience: Number(form.experience),
      weeklyWorkloadHours: Number(form.weeklyWorkloadHours),
      performanceScore: Number(form.performanceScore),
      department: form.department || undefined,
      subjects: form.subjects.map(toSubjectId).filter(Boolean),
    };

    try {
      if (isEdit) {
        await updateTrainer(trainer._id, payload);
      } else {
        await createTrainer(payload);
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
      title={isEdit ? 'Edit Trainer' : 'Add Trainer'}
      onClose={() => onClose(false)}
      size="toms-modal-lg"
      scrollable
    >
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Employee ID *</label>
                  <input name="employeeId" className="form-control" value={form.employeeId} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Name *</label>
                  <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input type="email" name="email" className="form-control" value={form.email} onChange={handleChange} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone</label>
                  <input name="phone" className="form-control" value={form.phone} onChange={handleChange} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">CAMU ERP ID</label>
                  <input name="camuErpId" className="form-control" value={form.camuErpId} onChange={handleChange} placeholder="adjfaculty-90@mbu.asia" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">CAMU Password</label>
                  <input name="camuPassword" type="text" className="form-control" value={form.camuPassword} onChange={handleChange} autoComplete="off" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Department</label>
                  <StyledSelect
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder="Select department"
                    options={[
                      { value: '', label: 'Select department' },
                      ...departments.map((d) => ({
                        value: d._id,
                        label: `${d.name} (${d.code})`,
                      })),
                    ]}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Availability</label>
                  <StyledSelect
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    options={[
                      { value: 'active', label: 'Available' },
                      { value: 'unavailable', label: 'Unavailable' },
                    ]}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Experience (years)</label>
                  <input type="number" name="experience" className="form-control" min="0" value={form.experience} onChange={handleChange} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Joining Date</label>
                  <input type="date" name="joiningDate" className="form-control" value={form.joiningDate} onChange={handleChange} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Weekly Workload (hrs)</label>
                  <input type="number" name="weeklyWorkloadHours" className="form-control" min="0" value={form.weeklyWorkloadHours} onChange={handleChange} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Performance Score</label>
                  <input type="number" name="performanceScore" className="form-control" min="0" max="100" value={form.performanceScore} onChange={handleChange} />
                </div>
                <div className="col-12">
                  <label className="form-label">Skills (comma-separated)</label>
                  <input name="skills" className="form-control" placeholder="Java, Python, ML" value={form.skills} onChange={handleChange} />
                </div>
                <div className="col-12">
                  <label className="form-label">Subjects</label>
                  <select multiple className="form-select" value={form.subjects} onChange={handleSubjectChange} size="4">
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                  <small className="text-muted">Hold Ctrl/Cmd to select multiple</small>
                </div>
              </div>
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TrainerFormModal;
