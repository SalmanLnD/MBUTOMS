import { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getSchools, getDepartments } from '../services/subjectService.js';
import {
  getTestReportFilterOptions,
  getTestReportSubjects,
  getTestReportSummary,
  getTestReportGrid,
  bulkUpsertTestReports,
  getTestReportSheetStatus,
  downloadTestReportExcel,
} from '../services/studentTestReportService.js';
import {
  buildMonthOptions,
  clampMonthParts,
  formatMonthKey,
  formatMonthLabel,
  getCurrentMonthParts,
  getTrackingStartParts,
  parseMonthKey,
  shiftMonth,
  STUDENT_TEST_REPORT_TRACKING_START,
} from '../utils/studentTestReportDates.js';
import {
  DEFAULT_MAX_MARKS,
  PASS_PERCENTAGE,
  DEFAULT_ATTENDANCE,
  ATTENDANCE_ABSENT,
  ATTENDANCE_PRESENT,
  computePercentage,
  formatPassStatus,
  resolveAttendance,
} from '../utils/studentTestReportConstants.js';
import StudentTestReportSheetSetupModal from './StudentTestReportSheetSetupModal.jsx';
import { DownloadIcon, ExternalLinkIcon, SheetIcon } from './icons.jsx';

const SEMESTER_ORDER = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const semesterSortKey = (sem) => SEMESTER_ORDER[String(sem || '').trim()] ?? 99;

const SUB_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'marks', label: 'Mark Entry' },
];

const MonthPicker = ({
  monthKey,
  monthOptions,
  atEarliestMonth,
  atLatestMonth,
  onChange,
  onPrevious,
  onNext,
}) => (
  <div className="d-flex align-items-center gap-1">
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      disabled={atEarliestMonth}
      onClick={onPrevious}
      aria-label="Previous month"
    >
      &lt;
    </button>
    <select
      className="form-select form-select-sm"
      value={monthKey}
      onChange={(e) => onChange(parseMonthKey(e.target.value))}
      aria-label="Select month"
    >
      {monthOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      disabled={atLatestMonth}
      onClick={onNext}
      aria-label="Next month"
    >
      &gt;
    </button>
  </div>
);

const StudentMonthlyTestReportsTab = () => {
  const { hasManagementRole } = useAuth();
  const canManageSheets = hasManagementRole();

  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [monthParts, setMonthParts] = useState(() =>
    clampMonthParts(getCurrentMonthParts())
  );
  const [classes, setClasses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [schoolFilter, setSchoolFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [pyFilter, setPyFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [grid, setGrid] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [showSheetSetup, setShowSheetSetup] = useState(false);

  const monthKey = formatMonthKey(monthParts.year, monthParts.month);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const trackingMonth = parseMonthKey(STUDENT_TEST_REPORT_TRACKING_START.slice(0, 7));
  const latestMonth = getCurrentMonthParts();
  const monthLabel = formatMonthLabel(monthParts.year, monthParts.month);

  const atEarliestMonth =
    monthParts.year === trackingMonth.year && monthParts.month === trackingMonth.month;
  const atLatestMonth =
    monthParts.year === latestMonth.year && monthParts.month === latestMonth.month;

  const departmentCodesBySchoolId = useMemo(() => {
    const map = new Map();
    departments.forEach((department) => {
      const schoolId = department.school?._id || department.school;
      if (!schoolId) return;
      const key = String(schoolId);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(department.code);
      if (department.code === 'CE-ME') map.get(key).add('CE & ME');
      if (department.code === 'ECE' || department.code === 'EIE') map.get(key).add('ECE & EIE');
      if (department.code === 'BCOM-CA') map.get(key).add('B.COM(CA)');
    });
    return map;
  }, [departments]);

  const filterOptions = useMemo(() => {
    const schoolDeptCodes = schoolFilter
      ? (departmentCodesBySchoolId.get(schoolFilter) || new Set())
      : null;
    const scoped = schoolDeptCodes
      ? classes.filter((cls) => schoolDeptCodes.has(cls.department))
      : classes;

    const depts = [...new Set(scoped.map((c) => c.department).filter(Boolean))].sort();
    const sections = [...new Set(
      scoped
        .filter((c) => !deptFilter || c.department === deptFilter)
        .map((c) => c.section)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const pys = [...new Set(scoped.map((c) => c.py).filter(Boolean))].sort((a, b) => a - b);
    const semesters = [...new Set(scoped.map((c) => c.currentSemester).filter(Boolean))]
      .sort((a, b) => semesterSortKey(a) - semesterSortKey(b));

    return { depts, sections, pys, semesters };
  }, [classes, schoolFilter, deptFilter, departmentCodesBySchoolId]);

  const selectedClass = useMemo(() => {
    if (!deptFilter || !sectionFilter || !semFilter) return null;
    const matches = classes.filter(
      (cls) =>
        cls.department === deptFilter
        && cls.section === sectionFilter
        && cls.currentSemester === semFilter
        && (!pyFilter || cls.py === Number(pyFilter))
    );
    return matches[0] || null;
  }, [classes, deptFilter, sectionFilter, semFilter, pyFilter]);

  const canLoadGrid = Boolean(deptFilter && sectionFilter && semFilter && subjectFilter);

  useEffect(() => {
    (async () => {
      setLoadingOptions(true);
      try {
        const [classList, schoolList, departmentList] = await Promise.all([
          getTestReportFilterOptions(),
          getSchools(),
          getDepartments(),
        ]);
        setClasses(Array.isArray(classList) ? classList : []);
        setSchools(Array.isArray(schoolList) ? schoolList : []);
        setDepartments(Array.isArray(departmentList) ? departmentList : []);
      } catch (err) {
        showError(getErrorMessage(err));
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!canManageSheets) return;
    getTestReportSheetStatus()
      .then(setSheetStatus)
      .catch(() => setSheetStatus(null));
  }, [canManageSheets]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await getTestReportSummary({ month: monthKey });
      setSummary(data);
    } catch (err) {
      showError(getErrorMessage(err));
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [monthKey]);

  useEffect(() => {
    if (activeSubTab !== 'summary') return;
    loadSummary();
  }, [activeSubTab, loadSummary]);

  useEffect(() => {
    if (activeSubTab !== 'marks') return;
    if (!deptFilter || !sectionFilter || !semFilter) {
      setSubjects([]);
      setSubjectFilter('');
      return;
    }

    setLoadingSubjects(true);
    getTestReportSubjects({
      department: deptFilter,
      section: sectionFilter,
      semester: semFilter,
    })
      .then((list) => {
        setSubjects(Array.isArray(list) ? list : []);
        setSubjectFilter((current) => {
          if (current && list.some((item) => item._id === current)) return current;
          return list[0]?._id || '';
        });
      })
      .catch((err) => {
        showError(getErrorMessage(err));
        setSubjects([]);
        setSubjectFilter('');
      })
      .finally(() => setLoadingSubjects(false));
  }, [activeSubTab, deptFilter, sectionFilter, semFilter]);

  const loadGrid = useCallback(async () => {
    if (!canLoadGrid) {
      setGrid(null);
      setDrafts({});
      return;
    }

    setLoadingGrid(true);
    try {
      const data = await getTestReportGrid({
        month: monthKey,
        department: deptFilter,
        section: sectionFilter,
        semester: semFilter,
        py: pyFilter || undefined,
        subject: subjectFilter,
      });
      setGrid(data);
      const nextDrafts = {};
      (data.students || []).forEach((row) => {
        const attendance = row.report
          ? resolveAttendance(row.report)
          : DEFAULT_ATTENDANCE;
        nextDrafts[row._id] = {
          attendance,
          marksObtained: attendance === ATTENDANCE_ABSENT
            ? ''
            : (row.report?.marksObtained ?? ''),
          maxMarks: row.report?.maxMarks ?? DEFAULT_MAX_MARKS,
        };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      showError(getErrorMessage(err));
      setGrid(null);
      setDrafts({});
    } finally {
      setLoadingGrid(false);
    }
  }, [canLoadGrid, monthKey, deptFilter, sectionFilter, semFilter, pyFilter, subjectFilter]);

  useEffect(() => {
    if (activeSubTab !== 'marks') return;
    loadGrid();
  }, [activeSubTab, loadGrid]);

  const updateDraft = (studentId, field, value) => {
    setDrafts((prev) => {
      const current = prev[studentId] || {};
      const next = { ...current, [field]: value };
      if (field === 'attendance' && value === ATTENDANCE_ABSENT) {
        next.marksObtained = '';
      }
      return { ...prev, [studentId]: next };
    });
  };

  const handleSave = async () => {
    if (!canLoadGrid || !grid?.students?.length) return;

    setSaving(true);
    try {
      const entries = grid.students.map((row) => {
        const draft = drafts[row._id] || {};
        const attendance = resolveAttendance(draft.attendance);
        return {
          studentId: row._id,
          attendance,
          marksObtained: attendance === ATTENDANCE_ABSENT
            ? ''
            : (draft.marksObtained ?? ''),
          maxMarks: draft.maxMarks ?? DEFAULT_MAX_MARKS,
        };
      });

      const result = await bulkUpsertTestReports({
        month: monthKey,
        department: deptFilter,
        section: sectionFilter,
        semester: semFilter,
        py: pyFilter ? Number(pyFilter) : selectedClass?.py,
        subject: subjectFilter,
        entries,
      });
      showSuccess(result.message || 'Test reports saved');
      await loadGrid();
      await loadSummary();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const blob = await downloadTestReportExcel(monthKey);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monthly-test-reports-${monthKey}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const clearFilters = () => {
    setSchoolFilter('');
    setDeptFilter('');
    setSectionFilter('');
    setPyFilter('');
    setSemFilter('');
    setSubjectFilter('');
  };

  const hasFilters = Boolean(
    schoolFilter || deptFilter || sectionFilter || pyFilter || semFilter || subjectFilter
  );

  const shiftMonthParts = (delta) => setMonthParts((prev) => shiftMonth(prev, delta));

  if (loadingOptions) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
          disabled={downloading}
          onClick={handleDownloadExcel}
        >
          <DownloadIcon size={16} aria-hidden="true" />
          {downloading ? 'Downloading...' : 'Download Excel'}
        </button>
        {canManageSheets && (
          sheetStatus?.linked ? (
            <>
              <a
                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
                href={sheetStatus.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon size={16} aria-hidden="true" />
                Open test reports sheet
              </a>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
                onClick={() => setShowSheetSetup(true)}
              >
                <SheetIcon size={16} aria-hidden="true" />
                Sheet setup
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
              onClick={() => setShowSheetSetup(true)}
            >
              <SheetIcon size={16} aria-hidden="true" />
              Link test reports sheet
            </button>
          )
        )}
        <span className="text-muted small">
          Pass threshold: {PASS_PERCENTAGE}% (absent excluded) · Default marks: out of {DEFAULT_MAX_MARKS} · P/A default: Present
        </span>
      </div>

      <ul className="nav nav-tabs mb-3">
        {SUB_TABS.map((tab) => (
          <li className="nav-item" key={tab.id}>
            <button
              type="button"
              className={`nav-link ${activeSubTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeSubTab === 'summary' && (
        <>
          <div className="row g-2 mb-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label small text-muted mb-1">Month</label>
              <MonthPicker
                monthKey={monthKey}
                monthOptions={monthOptions}
                atEarliestMonth={atEarliestMonth}
                atLatestMonth={atLatestMonth}
                onChange={setMonthParts}
                onPrevious={() => shiftMonthParts(-1)}
                onNext={() => shiftMonthParts(1)}
              />
            </div>
          </div>

          <div className="card table-card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">
                  Subject-wise summary — {summary?.monthLabel || monthLabel}
                </h6>
                {loadingSummary && <span className="text-muted small">Updating...</span>}
              </div>
              {loadingSummary && !summary ? (
                <LoadingSpinner />
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Graded</th>
                        <th>Passed</th>
                        <th>Failed</th>
                        <th>Absent</th>
                        <th>Pass %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!summary?.subjects?.length ? (
                        <tr>
                          <td colSpan="7" className="text-center text-muted py-3">
                            No marks entered for this month yet
                          </td>
                        </tr>
                      ) : (
                        summary.subjects.map((row) => (
                          <tr key={`${row.subjectCode}-${row.subjectName}`}>
                            <td>{row.subjectName}</td>
                            <td>{row.subjectCode || '—'}</td>
                            <td>{row.entered}</td>
                            <td>{row.passed}</td>
                            <td>{row.failed}</td>
                            <td>{row.absent ?? 0}</td>
                            <td>
                              {row.passPercentage != null ? (
                                <span className={row.passPercentage >= PASS_PERCENTAGE ? 'text-success' : 'text-danger'}>
                                  {row.passPercentage}%
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mb-2 mt-4">
                <h6 className="mb-0">Class-wise summary</h6>
              </div>
              {loadingSummary && !summary ? (
                <LoadingSpinner />
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Graded</th>
                        <th>Passed</th>
                        <th>Failed</th>
                        <th>Absent</th>
                        <th>Pass %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!summary?.classes?.length ? (
                        <tr>
                          <td colSpan="7" className="text-center text-muted py-3">
                            No class data for this month yet
                          </td>
                        </tr>
                      ) : (
                        summary.classes.map((row) => (
                          <tr key={`${row.department}-${row.section}-${row.semester}-${row.subjectCode}`}>
                            <td>{row.department} {row.section} · Sem {row.semester}</td>
                            <td>{row.subjectName}</td>
                            <td>{row.entered}</td>
                            <td>{row.passed}</td>
                            <td>{row.failed}</td>
                            <td>{row.absent ?? 0}</td>
                            <td>
                              {row.passPercentage != null ? (
                                <span className={row.passPercentage >= PASS_PERCENTAGE ? 'text-success' : 'text-danger'}>
                                  {row.passPercentage}%
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeSubTab === 'marks' && (
        <>
          <div className="row g-2 mb-3 align-items-end">
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">Month</label>
              <MonthPicker
                monthKey={monthKey}
                monthOptions={monthOptions}
                atEarliestMonth={atEarliestMonth}
                atLatestMonth={atLatestMonth}
                onChange={setMonthParts}
                onPrevious={() => shiftMonthParts(-1)}
                onNext={() => shiftMonthParts(1)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">School</label>
              <select
                className="form-select form-select-sm"
                value={schoolFilter}
                onChange={(e) => {
                  setSchoolFilter(e.target.value);
                  setDeptFilter('');
                  setSectionFilter('');
                  setSubjectFilter('');
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
              <label className="form-label small text-muted mb-1">Department</label>
              <select
                className="form-select form-select-sm"
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setSectionFilter('');
                  setSubjectFilter('');
                }}
                aria-label="Filter by department"
              >
                <option value="">Select department</option>
                {filterOptions.depts.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div className="col-md-1">
              <label className="form-label small text-muted mb-1">Section</label>
              <select
                className="form-select form-select-sm"
                value={sectionFilter}
                onChange={(e) => {
                  setSectionFilter(e.target.value);
                  setSubjectFilter('');
                }}
                aria-label="Filter by section"
                disabled={!deptFilter}
              >
                <option value="">Section</option>
                {filterOptions.sections.map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>
            <div className="col-md-1">
              <label className="form-label small text-muted mb-1">PY</label>
              <select
                className="form-select form-select-sm"
                value={pyFilter}
                onChange={(e) => setPyFilter(e.target.value)}
                aria-label="Filter by PY"
              >
                <option value="">All PY</option>
                {filterOptions.pys.map((py) => (
                  <option key={py} value={py}>{py}</option>
                ))}
              </select>
            </div>
            <div className="col-md-1">
              <label className="form-label small text-muted mb-1">Semester</label>
              <select
                className="form-select form-select-sm"
                value={semFilter}
                onChange={(e) => {
                  setSemFilter(e.target.value);
                  setSubjectFilter('');
                }}
                aria-label="Filter by semester"
              >
                <option value="">Sem</option>
                {filterOptions.semesters.map((sem) => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">Subject</label>
              <select
                className="form-select form-select-sm"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                aria-label="Filter by subject"
                disabled={!deptFilter || !sectionFilter || !semFilter || loadingSubjects}
              >
                <option value="">
                  {loadingSubjects ? 'Loading...' : 'Select subject'}
                </option>
                {subjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>{subject.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2 d-flex gap-2">
              {hasFilters && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
                  Clear
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-primary ms-auto"
                disabled={!canLoadGrid || !grid?.students?.length || saving}
                onClick={handleSave}
              >
                {saving ? 'Saving...' : 'Save Marks'}
              </button>
            </div>
          </div>

          {!canLoadGrid && (
            <div className="alert alert-info">
              Select department, section, semester, and subject to enter marks for {monthLabel}.
            </div>
          )}

          {canLoadGrid && classes.length === 0 && (
            <div className="alert alert-warning">
              No classes assigned to your timetable. Contact an administrator if this looks wrong.
            </div>
          )}

          {canLoadGrid && !loadingSubjects && subjects.length === 0 && (
            <div className="alert alert-warning">
              No subjects found for this class in the timetable.
            </div>
          )}

          {canLoadGrid && loadingGrid ? (
            <LoadingSpinner />
          ) : canLoadGrid && grid ? (
            <div className="card table-card">
              <div className="card-body table-responsive">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div className="text-muted small">
                    {grid.subject?.name} ({grid.subject?.code})
                    {' · '}
                    {grid.students.length} student{grid.students.length === 1 ? '' : 's'}
                    {' · '}
                    {deptFilter} {sectionFilter} · Sem {semFilter}
                    {pyFilter ? ` · PY ${pyFilter}` : ''}
                  </div>
                  {grid.classSummary && (
                    <div className="text-muted small">
                      Class pass rate:{' '}
                      {grid.classSummary.passPercentage != null ? (
                        <strong>{grid.classSummary.passPercentage}%</strong>
                      ) : (
                        '—'
                      )}
                      {' '}
                      ({grid.classSummary.passed}/{grid.classSummary.entered} graded
                      {grid.classSummary.absent ? ` · ${grid.classSummary.absent} absent` : ''})
                    </div>
                  )}
                </div>
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Roll No.</th>
                      <th>Name</th>
                      <th style={{ width: '80px' }}>P/A</th>
                      <th style={{ width: '100px' }}>Marks</th>
                      <th style={{ width: '90px' }}>Out of</th>
                      <th style={{ width: '90px' }}>%</th>
                      <th style={{ width: '80px' }}>Result</th>
                      <th>Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.students.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          No active students in this class
                        </td>
                      </tr>
                    ) : (
                      grid.students.map((row) => {
                        const draft = drafts[row._id] || {};
                        const attendance = resolveAttendance(draft.attendance);
                        const absent = attendance === ATTENDANCE_ABSENT;
                        const maxMarks = draft.maxMarks ?? DEFAULT_MAX_MARKS;
                        const pct = computePercentage(draft.marksObtained, maxMarks, attendance);
                        const result = formatPassStatus(draft.marksObtained, maxMarks, attendance);
                        return (
                          <tr key={row._id}>
                            <td>{row.rollNumber}</td>
                            <td>{row.name}</td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={attendance}
                                onChange={(e) => updateDraft(row._id, 'attendance', e.target.value)}
                                aria-label={`Attendance for ${row.name}`}
                              >
                                <option value={ATTENDANCE_PRESENT}>P</option>
                                <option value={ATTENDANCE_ABSENT}>A</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                min="0"
                                max={maxMarks}
                                step="0.5"
                                value={draft.marksObtained ?? ''}
                                onChange={(e) => updateDraft(row._id, 'marksObtained', e.target.value)}
                                placeholder="—"
                                disabled={absent}
                                aria-label={`Marks for ${row.name}`}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                min="1"
                                value={maxMarks}
                                onChange={(e) => updateDraft(row._id, 'maxMarks', e.target.value)}
                                disabled={absent}
                                aria-label={`Max marks for ${row.name}`}
                              />
                            </td>
                            <td>{pct != null ? `${pct}%` : '—'}</td>
                            <td>
                              <span className={
                                result === 'Pass'
                                  ? 'badge bg-success'
                                  : result === 'Fail'
                                    ? 'badge bg-danger'
                                    : result === 'Absent'
                                      ? 'badge bg-warning text-dark'
                                      : 'badge bg-secondary'
                              }
                              >
                                {result}
                              </span>
                            </td>
                            <td className="text-muted small">
                              {row.report?.enteredBy ? (
                                <>
                                  {row.report.enteredBy}
                                  {row.report.updatedAt && (
                                    <>
                                      <br />
                                      {new Date(row.report.updatedAt).toLocaleDateString('en-IN')}
                                    </>
                                  )}
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}

      {showSheetSetup && canManageSheets && (
        <StudentTestReportSheetSetupModal
          show
          initialUrl={sheetStatus?.spreadsheetUrl || ''}
          onClose={() => setShowSheetSetup(false)}
          onLinked={() => {
            setShowSheetSetup(false);
            showSuccess('Test reports sheet linked');
            getTestReportSheetStatus().then(setSheetStatus).catch(() => setSheetStatus(null));
          }}
        />
      )}
    </>
  );
};

export default StudentMonthlyTestReportsTab;
