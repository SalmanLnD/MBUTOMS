import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';
import { createClass, updateClass } from '../services/classService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { defaultPyForSemester } from '../utils/classPy.js';

const SEMESTER_OPTIONS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Class department labels that differ from reference department codes. */
const CLASS_DEPARTMENT_BY_CODE = {
  'CE-ME': 'CE & ME',
  ECE: 'ECE & EIE',
  EIE: 'ECE & EIE',
  'BCOM-CA': 'B.COM(CA)',
};

const toClassDepartment = (code) => CLASS_DEPARTMENT_BY_CODE[code] || code;
const toId = (value) => String(value?._id || value || '');

const emptyForm = {
  school: '',
  department: '',
  section: '',
  py: defaultPyForSemester('III'),
  currentSemester: 'III',
  status: 'active',
};

const ClassFormModal = ({ show, classItem, schools = [], departments = [], onClose, onSaved }) => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(classItem);

  const schoolIdByClassDepartment = useMemo(() => {
    const map = new Map();
    departments.forEach((dept) => {
      const schoolId = toId(dept.school);
      if (!schoolId || !dept.code) return;
      map.set(dept.code, schoolId);
      map.set(toClassDepartment(dept.code), schoolId);
    });
    return map;
  }, [departments]);

  const departmentSuggestions = useMemo(() => {
    const labels = departments
      .filter((dept) => !form.school || toId(dept.school) === form.school)
      .map((dept) => toClassDepartment(dept.code))
      .filter(Boolean);
    return [...new Set(labels)].sort();
  }, [departments, form.school]);

  useEffect(() => {
    if (classItem) {
      setForm({
        school: toId(classItem.school) || schoolIdByClassDepartment.get(classItem.department) || '',
        department: classItem.department || '',
        section: classItem.section || '',
        py: classItem.py || emptyForm.py,
        currentSemester: classItem.currentSemester || 'III',
        status: classItem.status || 'active',
      });
    } else {
      setForm(emptyForm);
    }
  }, [classItem, schoolIdByClassDepartment]);

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
    if (name === 'department') {
      setForm((prev) => {
        const mappedSchool = schoolIdByClassDepartment.get(value.trim());
        return { ...prev, department: value, school: mappedSchool || prev.school };
      });
      return;
    }
    setForm((prev) => ({
      ...prev,
      [name]: name === 'py' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.school) {
      setError('Select a school for this class.');
      return;
    }
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
              <label className="form-label" htmlFor="class-school">School</label>
              <StyledSelect
                id="class-school"
                name="school"
                value={form.school}
                onChange={handleChange}
                required
                placeholder="Select school"
                options={[
                  { value: '', label: 'Select school' },
                  ...schools.map((school) => ({ value: school._id, label: school.name })),
                ]}
              />
            </div>
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
                list="class-department-options"
                autoComplete="off"
              />
              <datalist id="class-department-options">
                {departmentSuggestions.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
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
