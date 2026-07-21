import { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import StudentFormModal from '../components/StudentFormModal.jsx';
import StudentBulkUploadModal from '../components/StudentBulkUploadModal.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { usePagination } from '../hooks/usePagination.js';
import ClassFormModal from '../components/ClassFormModal.jsx';
import { getClasses, deleteClass } from '../services/classService.js';
import {
  getStudents,
  deleteStudent,
} from '../services/studentService.js';
import { getSchools, getDepartments } from '../services/subjectService.js';
import { getAttendance, markAttendance } from '../services/attendanceService.js';
import { formatDate, formatStatus, getErrorMessage, toInputDate } from '../utils/helpers.js';
import { EditIcon, EyeIcon, TrashIcon, UploadIcon } from '../components/icons.jsx';
import ActionIconButton from '../components/ActionIconButton.jsx';

const statusOptions = ['present', 'absent', 'late', 'leave', 'od', 'holiday'];
const SEMESTER_ORDER = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const semesterSortKey = (sem) => SEMESTER_ORDER[String(sem || '').trim()] ?? 99;
const tabs = [
  { id: 'classes', label: 'Classes' },
  { id: 'students', label: 'Students' },
  { id: 'attendance', label: 'Student Attendance' },
];

const ClassesStudents = () => {
  const { hasManagementRole } = useAuth();
  const canManage = hasManagementRole();

  const [activeTab, setActiveTab] = useState('classes');

  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [showClassForm, setShowClassForm] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [pendingClassDelete, setPendingClassDelete] = useState(null);
  const [classFilter, setClassFilter] = useState(null);
  const [classPyFilter, setClassPyFilter] = useState('');
  const [classSchoolFilter, setClassSchoolFilter] = useState('');
  const [classDeptFilter, setClassDeptFilter] = useState('');
  const [classSectionFilter, setClassSectionFilter] = useState('');
  const [classSemFilter, setClassSemFilter] = useState('');
  const [classSortBy, setClassSortBy] = useState('department');
  const [classSortOrder, setClassSortOrder] = useState('asc');
  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);

  const classLabel = (cls) => cls.label || `${cls.department} ${cls.section}`;

  const departmentCodesBySchoolId = useMemo(() => {
    const map = new Map();
    departments.forEach((department) => {
      const schoolId = department.school?._id || department.school;
      if (!schoolId) return;
      const key = String(schoolId);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(department.code);
      // Class/timetable aliases used alongside department codes.
      if (department.code === 'CE-ME') {
        map.get(key).add('CE & ME');
      }
      if (department.code === 'ECE' || department.code === 'EIE') {
        map.get(key).add('ECE & EIE');
      }
      if (department.code === 'BCOM-CA') {
        map.get(key).add('B.COM(CA)');
      }
    });
    return map;
  }, [departments]);

  const schoolNameByClassDepartment = useMemo(() => {
    const map = new Map();
    departments.forEach((department) => {
      const schoolName = department.school?.name || '';
      if (!schoolName || !department.code) return;
      map.set(department.code, schoolName);
      if (department.code === 'CE-ME') {
        map.set('CE & ME', schoolName);
      }
      if (department.code === 'ECE' || department.code === 'EIE') {
        map.set('ECE & EIE', schoolName);
      }
      if (department.code === 'BCOM-CA') {
        map.set('B.COM(CA)', schoolName);
      }
    });
    return map;
  }, [departments]);

  const classSchoolName = (cls) =>
    schoolNameByClassDepartment.get(cls.department) || '-';

  const classFilterOptions = useMemo(() => {
    const schoolDeptCodes = classSchoolFilter
      ? (departmentCodesBySchoolId.get(classSchoolFilter) || new Set())
      : null;
    const schoolScopedClasses = schoolDeptCodes
      ? classes.filter((cls) => schoolDeptCodes.has(cls.department))
      : classes;

    const pys = [...new Set(schoolScopedClasses.map((c) => c.py).filter(Boolean))].sort((a, b) => a - b);
    const depts = [...new Set(schoolScopedClasses.map((c) => c.department).filter(Boolean))].sort();
    const sections = [...new Set(
      schoolScopedClasses
        .filter((c) => !classDeptFilter || c.department === classDeptFilter)
        .map((c) => c.section)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const semesters = [...new Set(schoolScopedClasses.map((c) => c.currentSemester).filter(Boolean))]
      .sort((a, b) => semesterSortKey(a) - semesterSortKey(b));
    return { pys, depts, sections, semesters };
  }, [classes, classDeptFilter, classSchoolFilter, departmentCodesBySchoolId]);

  const filteredClasses = useMemo(() => {
    const schoolDeptCodes = classSchoolFilter
      ? (departmentCodesBySchoolId.get(classSchoolFilter) || new Set())
      : null;
    const filtered = classes.filter((cls) => {
      if (schoolDeptCodes && !schoolDeptCodes.has(cls.department)) return false;
      if (classPyFilter && cls.py !== Number(classPyFilter)) return false;
      if (classDeptFilter && cls.department !== classDeptFilter) return false;
      if (classSectionFilter && cls.section !== classSectionFilter) return false;
      if (classSemFilter && cls.currentSemester !== classSemFilter) return false;
      return true;
    });

    const dir = classSortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (classSortBy) {
        case 'py':
          cmp = (a.py ?? 0) - (b.py ?? 0);
          break;
        case 'department':
          cmp = String(a.department || '').localeCompare(String(b.department || ''));
          break;
        case 'section':
          cmp = String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true });
          break;
        case 'currentSemester':
          cmp = semesterSortKey(a.currentSemester) - semesterSortKey(b.currentSemester);
          break;
        default:
          cmp = String(a.department || '').localeCompare(String(b.department || ''));
      }
      return cmp * dir;
    });
  }, [
    classes,
    classSchoolFilter,
    classPyFilter,
    classDeptFilter,
    classSectionFilter,
    classSemFilter,
    classSortBy,
    classSortOrder,
    departmentCodesBySchoolId,
  ]);

  const hasClassFilters = Boolean(
    classSchoolFilter || classPyFilter || classDeptFilter || classSectionFilter || classSemFilter
  );

  const handleClassSort = (field) => {
    if (classSortBy === field) {
      setClassSortOrder(classSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setClassSortBy(field);
      setClassSortOrder('asc');
    }
  };

  const classSortIcon = (field) => (classSortBy === field ? (classSortOrder === 'asc' ? ' ↑' : ' ↓') : '');

  const clearClassTableFilters = () => {
    setClassSchoolFilter('');
    setClassPyFilter('');
    setClassDeptFilter('');
    setClassSectionFilter('');
    setClassSemFilter('');
  };

  const [students, setStudents] = useState([]);
  const {
    page: studentPage,
    setPage: setStudentPage,
    pageSize: studentPageSize,
    changePageSize: changeStudentPageSize,
    resetPage: resetStudentPage,
    pagination: studentPagination,
    setPagination: setStudentPagination,
  } = usePagination({ initialPageSize: 10 });
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('active');
  const [studentSchoolFilter, setStudentSchoolFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showStudentBulkUpload, setShowStudentBulkUpload] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const {
    page: attendancePage,
    setPage: setAttendancePage,
    pageSize: attendancePageSize,
    changePageSize: changeAttendancePageSize,
    resetPage: resetAttendancePage,
    pagination: attendancePagination,
    setPagination: setAttendancePagination,
  } = usePagination({ initialPageSize: 10 });
  const [attendanceLoading, setAttendanceLoading] = useState(true);
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
      showError(getErrorMessage(err));
    } finally {
      setClassesLoading(false);
    }
  };

  const fetchStudents = async () => {
    setStudentsLoading(true);
    try {
      const data = await getStudents({
        page: studentPage,
        limit: studentPageSize,
        search: debouncedStudentSearch,
        status: studentStatusFilter,
        school: studentSchoolFilter || undefined,
        department: departmentFilter,
        section: sectionFilter,
      });
      setStudents(data.students);
      setStudentPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setStudentsLoading(false);
    }
  };

  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const data = await getAttendance({
        page: attendancePage,
        limit: attendancePageSize,
        type: 'student',
        status: attendanceStatusFilter,
        student: attendanceForm.student || undefined,
      });
      setAttendanceRecords(data.records);
      setAttendancePagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    (async () => {
      try {
        const [schoolList, departmentList] = await Promise.all([
          getSchools(),
          getDepartments(),
        ]);
        setSchools(Array.isArray(schoolList) ? schoolList : []);
        setDepartments(Array.isArray(departmentList) ? departmentList : []);
      } catch (err) {
        showError(getErrorMessage(err));
      }
    })();
  }, []);

  useEffect(() => {
    if (activeTab === 'students') fetchStudents();
  }, [
    activeTab,
    studentPage,
    studentPageSize,
    debouncedStudentSearch,
    studentStatusFilter,
    studentSchoolFilter,
    departmentFilter,
    sectionFilter,
  ]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
  }, [activeTab, attendancePage, attendancePageSize, attendanceStatusFilter]);

  const handleViewClassStudents = (cls) => {
    setClassFilter(cls);
    setDepartmentFilter(cls.department);
    setSectionFilter(cls.section);
    const matchingDept = departments.find(
      (department) =>
        department.code === cls.department
        || (department.code === 'CE-ME' && cls.department === 'CE & ME')
        || ((department.code === 'ECE' || department.code === 'EIE')
          && cls.department === 'ECE & EIE')
        || (department.code === 'BCOM-CA' && cls.department === 'B.COM(CA)')
    );
    const schoolId = matchingDept?.school?._id || matchingDept?.school;
    setStudentSchoolFilter(schoolId ? String(schoolId) : '');
    setActiveTab('students');
    resetStudentPage();
  };

  const clearClassFilter = () => {
    setClassFilter(null);
    setDepartmentFilter('');
    setSectionFilter('');
    resetStudentPage();
  };

  const handleClassSaved = () => {
    setShowClassForm(false);
    setEditingClass(null);
    showSuccess('Class saved successfully');
    fetchClasses();
  };

  const handleConfirmClassDelete = async () => {
    if (!pendingClassDelete) return;
    try {
      await deleteClass(pendingClassDelete.id);
      showSuccess('Class removed');
      setPendingClassDelete(null);
      fetchClasses();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const handleStudentSaved = () => {
    setShowStudentForm(false);
    setEditingStudent(null);
    showSuccess('Student saved successfully');
    fetchStudents();
    fetchClasses();
  };

  const handleStudentBulkImported = (result) => {
    if ((result?.created || 0) + (result?.updated || 0) > 0) {
      showSuccess(result.message || 'Students imported');
      fetchStudents();
      fetchClasses();
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteStudent(pendingDelete.id);
      showSuccess('Student removed');
      setPendingDelete(null);
      fetchStudents();
      fetchClasses();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await markAttendance({ ...attendanceForm, type: 'student' });
      showSuccess('Student attendance marked');
      setShowAttendanceForm(false);
      fetchAttendance();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  return (
    <>
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
          <div className="row g-2 mb-3 align-items-center">
            <div className="col-md-2">
              <select
                className="form-select"
                value={classSchoolFilter}
                onChange={(e) => {
                  setClassSchoolFilter(e.target.value);
                  setClassDeptFilter('');
                  setClassSectionFilter('');
                }}
                aria-label="Filter by school"
              >
                <option value="">All Schools</option>
                {schools.map((school) => (
                  <option key={school._id} value={school._id}>{school.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={classPyFilter}
                onChange={(e) => setClassPyFilter(e.target.value)}
                aria-label="Filter by PY"
              >
                <option value="">All PY</option>
                {classFilterOptions.pys.map((py) => (
                  <option key={py} value={py}>{py}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={classDeptFilter}
                onChange={(e) => {
                  setClassDeptFilter(e.target.value);
                  setClassSectionFilter('');
                }}
                aria-label="Filter by department"
              >
                <option value="">All Departments</option>
                {classFilterOptions.depts.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div className="col-md-1">
              <select
                className="form-select"
                value={classSectionFilter}
                onChange={(e) => setClassSectionFilter(e.target.value)}
                aria-label="Filter by section"
              >
                <option value="">All Sections</option>
                {classFilterOptions.sections.map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={classSemFilter}
                onChange={(e) => setClassSemFilter(e.target.value)}
                aria-label="Filter by semester"
              >
                <option value="">All Semesters</option>
                {classFilterOptions.semesters.map((sem) => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>
            <div className="col-md-1">
              {hasClassFilters && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearClassTableFilters}>
                  Clear
                </button>
              )}
            </div>
            <div className="col-md-2 text-md-end">
              {canManage && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingClass(null);
                    setShowClassForm(true);
                  }}
                >
                  Add Class
                </button>
              )}
            </div>
          </div>

          {classesLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="card table-card">
              <div className="card-body table-responsive">
                {hasClassFilters && (
                  <div className="text-muted small mb-2">
                    Showing {filteredClasses.length} of {classes.length} classes
                  </div>
                )}
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th role="button" onClick={() => handleClassSort('py')}>
                        PY{classSortIcon('py')}
                      </th>
                      <th role="button" onClick={() => handleClassSort('department')}>
                        Department{classSortIcon('department')}
                      </th>
                      <th>School</th>
                      <th role="button" onClick={() => handleClassSort('section')}>
                        Section{classSortIcon('section')}
                      </th>
                      <th role="button" onClick={() => handleClassSort('currentSemester')}>
                        Current Semester{classSortIcon('currentSemester')}
                      </th>
                      <th>Students</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClasses.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">
                          {hasClassFilters ? 'No classes match the selected filters' : 'No classes found'}
                        </td>
                      </tr>
                    ) : (
                      filteredClasses.map((cls) => (
                        <tr key={cls._id}>
                          <td>{cls.py}</td>
                          <td>{cls.department || '-'}</td>
                          <td>{classSchoolName(cls)}</td>
                          <td>{cls.section || '-'}</td>
                          <td>{cls.currentSemester || '-'}</td>
                          <td>{cls.studentCount}</td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm action-btn-group d-inline-flex">
                              <ActionIconButton
                                variant="view"
                                icon={EyeIcon}
                                title="View students"
                                aria-label={`View students for ${classLabel(cls)}`}
                                onClick={() => handleViewClassStudents(cls)}
                              />
                              {canManage && (
                                <>
                                  <ActionIconButton
                                    variant="edit"
                                    icon={EditIcon}
                                    title="Edit class"
                                    aria-label={`Edit ${classLabel(cls)}`}
                                    onClick={() => {
                                      setEditingClass(cls);
                                      setShowClassForm(true);
                                    }}
                                  />
                                  <ActionIconButton
                                    variant="delete"
                                    icon={TrashIcon}
                                    title="Delete class"
                                    aria-label={`Delete ${classLabel(cls)}`}
                                    onClick={() => setPendingClassDelete({
                                      id: cls._id,
                                      name: classLabel(cls),
                                    })}
                                  />
                                </>
                              )}
                            </div>
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
                  resetStudentPage();
                }}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={studentSchoolFilter}
                onChange={(e) => {
                  setStudentSchoolFilter(e.target.value);
                  if (classFilter) clearClassFilter();
                  resetStudentPage();
                }}
                aria-label="Filter by school"
              >
                <option value="">All Schools</option>
                {schools.map((school) => (
                  <option key={school._id} value={school._id}>{school.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={studentStatusFilter}
                onChange={(e) => {
                  setStudentStatusFilter(e.target.value);
                  resetStudentPage();
                }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
            <div className="col-md-2">
              {classFilter && (
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-primary">
                    {classLabel(classFilter)}
                  </span>
                  <button type="button" className="btn btn-sm btn-link" onClick={clearClassFilter}>
                    Clear filter
                  </button>
                </div>
              )}
            </div>
            <div className="col-md-3 text-md-end">
              {canManage && (
                <div className="d-inline-flex flex-wrap gap-2 justify-content-md-end">
                  <button
                    type="button"
                    className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
                    onClick={() => setShowStudentBulkUpload(true)}
                  >
                    <UploadIcon size={16} />
                    Bulk Upload
                  </button>
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
                </div>
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
                      <th>PY</th>
                      <th>Semester</th>
                      <th>Email</th>
                      <th>Status</th>
                      {canManage && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={canManage ? 9 : 8} className="text-center text-muted py-4">
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
                          <td>{s.py || '-'}</td>
                          <td>{s.semesterLabel || s.semester?.name || '-'}</td>
                          <td>{s.email || '-'}</td>
                          <td>
                            <span className="badge bg-secondary">{formatStatus(s.status)}</span>
                          </td>
                          {canManage && (
                            <td className="text-end">
                              <div className="btn-group btn-group-sm action-btn-group d-inline-flex">
                                <ActionIconButton
                                  variant="edit"
                                  icon={EditIcon}
                                  title="Edit student"
                                  aria-label={`Edit ${s.name}`}
                                  onClick={() => {
                                    setEditingStudent(s);
                                    setShowStudentForm(true);
                                  }}
                                />
                                <ActionIconButton
                                  variant="delete"
                                  icon={TrashIcon}
                                  title="Delete student"
                                  aria-label={`Delete ${s.name}`}
                                  onClick={() => setPendingDelete({ id: s._id, name: s.name })}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <Pagination
                  pagination={studentPagination}
                  onPageChange={setStudentPage}
                  pageSize={studentPageSize}
                  onPageSizeChange={changeStudentPageSize}
                  showSummary
                  align="between"
                />
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
                  resetAttendancePage();
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
                <Pagination
                  pagination={attendancePagination}
                  onPageChange={setAttendancePage}
                  pageSize={attendancePageSize}
                  onPageSizeChange={changeAttendancePageSize}
                  showSummary
                  align="between"
                />
              </div>
            </div>
          )}
        </>
      )}

      {showClassForm && (
        <ClassFormModal
          show
          classItem={editingClass}
          onClose={() => {
            setShowClassForm(false);
            setEditingClass(null);
          }}
          onSaved={handleClassSaved}
        />
      )}

      {pendingClassDelete && (
        <ConfirmModal
          show
          title="Delete Class"
          message={`Delete class "${pendingClassDelete.name}"?`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmClassDelete}
          onClose={() => setPendingClassDelete(null)}
        />
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

      {showStudentBulkUpload && (
        <StudentBulkUploadModal
          show
          onClose={() => setShowStudentBulkUpload(false)}
          onImported={handleStudentBulkImported}
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
