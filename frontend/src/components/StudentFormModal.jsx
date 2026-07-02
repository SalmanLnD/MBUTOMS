import { useState, useEffect } from 'react';
import { createStudent, updateStudent } from '../services/studentService.js';
import { getErrorMessage } from '../utils/helpers.js';
import Modal from './Modal.jsx';

const emptyForm = {
  rollNumber: '',
  name: '',
  email: '',
  branch: '',
  sectionLabel: '',
  status: 'active',
};

const StudentFormModal = ({ show, student, defaultClass, onClose, onSaved }) => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(student);

  useEffect(() => {
    if (student) {
      setForm({
        rollNumber: student.rollNumber || '',
        name: student.name || '',
        email: student.email || '',
        branch: student.branch || '',
        sectionLabel: student.sectionLabel || student.section?.name || '',
        status: student.status || 'active',
      });
    } else if (defaultClass) {
      setForm({
        ...emptyForm,
        branch: defaultClass.department || '',
        sectionLabel: defaultClass.section || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [student, defaultClass]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await updateStudent(student._id, form);
      } else {
        await createStudent(form);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} title={isEdit ? 'Edit Student' : 'Add Student'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="mb-3">
            <label className="form-label">Roll Number</label>
            <input
              className="form-control"
              name="rollNumber"
              value={form.rollNumber}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Name</label>
            <input
              className="form-control"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              name="email"
              value={form.email}
              onChange={handleChange}
            />
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Branch / Department</label>
              <input
                className="form-control"
                name="branch"
                value={form.branch}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Section</label>
              <input
                className="form-control"
                name="sectionLabel"
                value={form.sectionLabel}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Status</label>
            <select className="form-select" name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default StudentFormModal;
