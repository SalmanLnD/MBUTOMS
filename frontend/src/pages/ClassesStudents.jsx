import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import StudentFormModal from '../components/StudentFormModal.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { getClasses } from '../services/classService.js';
import {
  getStudents,
  deleteStudent,
} from '../services/studentService.js';
import { getAttendance, markAttendance } from '../services/attendanceService.js';
import { formatDate, formatStatus, getErrorMessage, toInputDate } from '../utils/helpers.js';

const statusOptions = ['present', 'absent', 'late', 'leave', 'od', 'holiday'];
const tabs = [
  { id: 'classes', label: 'Classes' },
  { id: 'students', label: 'Students' },
  { id: 'attendance', label: 'Student Attendance' },
];

const ClassesStudents = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin', 'campus_manager');

  const [activeTab, setActiveTab] = useState('classes');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classFilter, setClassFilter] = useState(null);

  const [students, setStudents] = useState([]);
  const [studentPagination, setStudentPagination] = useState(null);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentPage, setStudentPage] = useState(1);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('active');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendancePagination, setAttendancePagination] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('');
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    type: 'student',
    student: '',
    date: toInputDate(new Date()),
    status: 'present',
    remarks: '',
  });

  const debouncedStudentSearch = useDebounce(studentSearch);

  const fetchClasses = async () => {
    setClassesLoading(true);
    try {
      const data = await getClasses();
      setClasses(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setClassesLoading(false);
    }
  };

  const fetchStudents = async () => {
    setStudentsLoading(true);
    try {
      const data = await getStudents({
        page: studentPage,
        limit: 10,
        search: debouncedStudentSearch,
        status: studentStatusFilter,
        department: departmentFilter,
        section: sectionFilter,
      });
      setStudents(data.students);
      setStudentPagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setStudentsLoading(false);
    }
  };

  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const data = await getAttendance({
        page: attendancePage,
        limit: 10,
        type: 'student',
        status: attendanceStatusFilter,
        student: attendanceForm.student || undefined,
      });
      setAttendanceRecords(data.records);
      setAttendancePagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (activeTab === 'students') fetchStudents();
  }, [activeTab, studentPage, debouncedStudentSearch, studentStatusFilter, departmentFilter, sectionFilter]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
  }, [activeTab, attendancePage, attendanceStatusFilter]);

  const handleViewClassStudents = (cls) => {
    setClassFilter(cls);
    setDepartmentFilter(cls.department);
    setSectionFilter(cls.section);
    setActiveTab('students');
    setStudentPage(1);
  };

  const clearClassFilter = () => {
    setClassFilter(null);
    setDepartmentFilter('');
    setSectionFilter('');
    setStudentPage(1);
  };

  const handleStudentSaved = () => {
    setShowStudentForm(false);
    setEditingStudent(null);
    setSuccess('Student saved successfully');
    fetchStudents();
    fetchClasses();
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteStudent(pendingDelete.id);
      setSuccess('Student removed');
      setPendingDelete(null);
      fetchStudents();
      fetchClasses();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await markAttendance({ ...attendanceForm, type: 'student' });
      setSuccess('Student attendance marked');
      setShowAttendanceForm(false);
      fetchAttendance();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Topbar title="Classes & Students" />
      <AlertMessage message={error} onClose={() => setError('')} />
      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />

      <ul className="nav nav-tabs mb-3">
        {tabs.map((tab) => (
          <li className="nav-item" key={tab.id}>
            <button
              type="button"
              className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'classes' && (
        <>
          {classesLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="card table-card">
              <div className="card-body table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Class</th>
                      <th>Department</th>
                      <th>Section</th>
                      <th>Students</th>
                      <th>Timetable Slots</th>
                      <th>Source</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {classes.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">
                          No classes found
                        </td>
                      </tr>
                    ) : (
                      classes.map((cls) => (
                        <tr key={cls.id}>
                          <td>{cls.label}</td>
                          <td>{cls.department || '-'}</td>
                          <td>{cls.section || '-'}</td>
                          <td>{cls.studentCount}</td>
                          <td>{cls.slotCount}</td>
                          <td className="text-capitalize">{cls.source}</td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleViewClassStudents(cls)}
                            >
                              View Students
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'students' && (
        <>
          <div className="row g-2 mb-3 align-items-center">
            <div className="col-md-3">
              <input
                type="search"
                className="form-control"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setStudentPage(1);
                }}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={studentStatusFilter}
                onChange={(e) => {
                  setStudentStatusFilter(e.target.value);
                  setStudentPage(1);
                }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
            <div className="col-md-4">
              {classFilter && (
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-primary">
                    {classFilter.label}
                  </span>
                  <button type="button" className="btn btn-sm btn-link" onClick={clearClassFilter}>
                    Clear filter
                  </button>
                </div>
              )}
            </div>
            <div className="col-md-3 text-md-end">
              {canManage && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingStudent(null);
                    setShowStudentForm(true);
                  }}
                >
                  Add Student
                </button>
              )}
            </div>
          </div>

          {studentsLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="card table-card">
              <div className="card-body table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Roll No.</th>
                      <th>Name</th>
                      <th>Branch</th>
                      <th>Section</th>
                      <th>Email</th>
                      <th>Status</th>
                      {canManage && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={canManage ? 7 : 6} className="text-center text-muted py-4">
                          No students found
                        </td>
                      </tr>
                    ) : (
                      students.map((s) => (
                        <tr key={s._id}>
                          <td>{s.rollNumber}</td>
                          <td>{s.name}</td>
                          <td>{s.branch || '-'}</td>
                          <td>{s.sectionLabel || s.section?.name || '-'}</td>
                          <td>{s.email || '-'}</td>
                          <td>
                            <span className="badge bg-secondary">{formatStatus(s.status)}</span>
                          </td>
                          {canManage && (
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary me-1"
                                onClick={() => {
                                  setEditingStudent(s);
                                  setShowStudentForm(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setPendingDelete({ id: s._id, name: s.name })}
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <Pagination pagination={studentPagination} onPageChange={setStudentPage} />
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'attendance' && (
        <>
          <div className="row g-2 mb-3 align-items-center">
            <div className="col-md-3">
              <select
                className="form-select"
                value={attendanceStatusFilter}
                onChange={(e) => {
                  setAttendanceStatusFilter(e.target.value);
                  setAttendancePage(1);
                }}
              >
                <option value="">All Status</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {formatStatus(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-9 text-md-end">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAttendanceForm(true)}
              >
                Mark Attendance
              </button>
            </div>
          </div>

          {attendanceLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="card table-card">
              <div className="card-body table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Date</th>
                      <th>Student</th>
                      <th>Roll No.</th>
                      <th>Status</th>
                      <th>Remarks</th>
                      <th>Marked By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          No student attendance records
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.map((r) => (
                        <tr key={r._id}>
                          <td>{formatDate(r.date)}</td>
                          <td>{r.student?.name || '-'}</td>
                          <td>{r.student?.rollNumber || '-'}</td>
                          <td>
                            <span className="badge bg-secondary">{formatStatus(r.status)}</span>
                          </td>
                          <td>{r.remarks || '-'}</td>
                          <td>{r.markedBy?.name || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <Pagination pagination={attendancePagination} onPageChange={setAttendancePage} />
              </div>
            </div>
          )}
        </>
      )}

      {showStudentForm && (
        <StudentFormModal
          show
          student={editingStudent}
          defaultClass={classFilter}
          onClose={() => {
            setShowStudentForm(false);
            setEditingStudent(null);
          }}
          onSaved={handleStudentSaved}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Student"
          message={`Delete student "${pendingDelete.name}"?`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {showAttendanceForm && (
        <StudentAttendanceFormModal
          show
          form={attendanceForm}
          setForm={setAttendanceForm}
          onClose={() => setShowAttendanceForm(false)}
          onSubmit={handleAttendanceSubmit}
        />
      )}
    </>
  );
};

const StudentAttendanceFormModal = ({ show, form, setForm, onClose, onSubmit }) => {
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    getStudents({ limit: 100, status: 'active' })
      .then((d) => setStudents(d.students || []))
      .finally(() => setLoadingStudents(false));
  }, []);

  return (
    <Modal show={show} title="Mark Student Attendance" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="toms-modal-body">
          <div className="mb-3">
            <label className="form-label">Student</label>
            {loadingStudents ? (
              <div className="text-muted small">Loading students...</div>
            ) : (
              <select
                className="form-select"
                value={form.student}
                onChange={(e) => setForm({ ...form, student: e.target.value })}
                required
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.rollNumber} - {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {formatStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">Remarks</label>
            <input
              className="form-control"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ClassesStudents;
