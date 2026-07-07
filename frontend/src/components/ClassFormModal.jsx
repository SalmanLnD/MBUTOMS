import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';
import { createClass, updateClass } from '../services/classService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { defaultPyForSemester } from '../utils/classPy.js';

const SEMESTER_OPTIONS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const emptyForm = {
  department: '',
  section: '',
  py: defaultPyForSemester('III'),
  currentSemester: 'III',
  status: 'active',
};

const ClassFormModal = ({ show, classItem, onClose, onSaved }) => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(classItem);

  useEffect(() => {
    if (classItem) {
      setForm({
        department: classItem.department || '',
        section: classItem.section || '',
        py: classItem.py || emptyForm.py,
        currentSemester: classItem.currentSemester || 'III',
        status: classItem.status || 'active',
      });
    } else {
      setForm(emptyForm);
    }
  }, [classItem]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'currentSemester') {
      setForm((prev) => ({
        ...prev,
        currentSemester: value,
        py: defaultPyForSemester(value),
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      [name]: name === 'py' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await updateClass(classItem._id, form);
      } else {
        await createClass(form);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} title={isEdit ? 'Edit Class' : 'Add Class'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="class-department">Department</label>
              <input
                id="class-department"
                name="department"
                className="form-control"
                value={form.department}
                onChange={handleChange}
                required
                placeholder="e.g. CSE"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="class-section">Section</label>
              <input
                id="class-section"
                name="section"
                className="form-control"
                value={form.section}
                onChange={handleChange}
                required
                placeholder="e.g. A1"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="class-py">PY</label>
              <input
                id="class-py"
                name="py"
                type="number"
                min="2000"
                max="2100"
                className="form-control"
                value={form.py}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="class-semester">Current Semester</label>
              <StyledSelect
                id="class-semester"
                name="currentSemester"
                value={form.currentSemester}
                onChange={handleChange}
                required
                options={SEMESTER_OPTIONS.map((sem) => ({
                  value: sem,
                  label: sem,
                }))}
              />
            </div>
            {isEdit && (
              <div className="col-md-6">
                <label className="form-label" htmlFor="class-status">Status</label>
                <StyledSelect
                  id="class-status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              </div>
            )}
          </div>
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Class'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ClassFormModal;
