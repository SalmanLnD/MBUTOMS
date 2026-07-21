import { useState, useEffect } from 'react';
import { createStudent, updateStudent } from '../services/studentService.js';
import { getClasses } from '../services/classService.js';
import { getErrorMessage } from '../utils/helpers.js';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';

const emptyForm = {
  rollNumber: '',
  name: '',
  email: '',
  classId: '',
  branch: '',
  sectionLabel: '',
  py: '',
  semesterLabel: '',
  status: 'active',
};

const StudentFormModal = ({ show, student, defaultClass, onClose, onSaved }) => {
  const [form, setForm] = useState(emptyForm);
  const [classOptions, setClassOptions] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(student);

  useEffect(() => {
    setClassesLoading(true);
    getClasses()
      .then((data) => setClassOptions(data || []))
      .finally(() => setClassesLoading(false));
  }, []);

  useEffect(() => {
    if (student) {
      const matched = classOptions.find(
        (item) =>
          item.department === student.branch
          && item.section === student.sectionLabel
          && (
            !student.py
            || Number(item.py) === Number(student.py)
          )
          && (
            !student.semesterLabel
            || item.currentSemester === student.semesterLabel
          )
      );
      setForm({
        rollNumber: student.rollNumber || '',
        name: student.name || '',
        email: student.email || '',
        classId: matched?._id || '',
        branch: student.branch || '',
        sectionLabel: student.sectionLabel || student.section?.name || '',
        py: student.py || matched?.py || '',
        semesterLabel: student.semesterLabel || matched?.currentSemester || '',
        status: student.status || 'active',
      });
    } else if (defaultClass) {
      setForm({
        ...emptyForm,
        classId: defaultClass._id || '',
        branch: defaultClass.department || '',
        sectionLabel: defaultClass.section || '',
        py: defaultClass.py || '',
        semesterLabel: defaultClass.currentSemester || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [student, defaultClass, classOptions]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'classId') {
      const cls = classOptions.find((item) => item._id === value);
      setForm((prev) => ({
        ...prev,
        classId: value,
        branch: cls?.department || '',
        sectionLabel: cls?.section || '',
        py: cls?.py || '',
        semesterLabel: cls?.currentSemester || '',
      }));
      return;
    }
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
          <div className="mb-3">
            <label className="form-label">Class</label>
            {classesLoading ? (
              <div className="text-muted small">Loading classes...</div>
            ) : (
              <StyledSelect
                name="classId"
                value={form.classId}
                onChange={handleChange}
                required
                placeholder="Select class"
                options={[
                  { value: '', label: 'Select class' },
                  ...classOptions.map((cls) => ({
                    value: cls._id,
                    label: `${cls.department} ${cls.section} · PY ${cls.py} · Sem ${cls.currentSemester}`,
                  })),
                ]}
              />
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">Status</label>
            <StyledSelect
              name="status"
              value={form.status}
              onChange={handleChange}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'graduated', label: 'Graduated' },
              ]}
            />
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
