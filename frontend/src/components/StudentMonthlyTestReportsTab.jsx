import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import CollapsibleFilters from './CollapsibleFilters.jsx';
import StyledSelect from './StyledSelect.jsx';
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
  sanitizeWholeNumberInput,
  validateMarkEntryDrafts,
  isMarkEntryComplete,
  matchesMarksFilter,
  MARKS_FILTER_OPTIONS,
  buildMarkEntryFieldKey,
  blockNumberInputWheel,
  blockDecimalNumberKeys,
  roundUpStoredMark,
  normalizeStoredMarkDraft,
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
    <StyledSelect
      size="sm"
      className="trainer-attendance-month-select"
      value={monthKey}
      onChange={(e) => onChange(parseMonthKey(e.target.value))}
      aria-label="Select month"
      options={monthOptions}
    />
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [marksFilterOp, setMarksFilterOp] = useState('any');
  const [marksFilterValue, setMarksFilterValue] = useState('');
  const markEntryTableRef = useRef(null);

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
        const normalized = normalizeStoredMarkDraft({
          attendance,
          marksObtained: row.report?.marksObtained,
          maxMarks: row.report?.maxMarks ?? DEFAULT_MAX_MARKS,
        });
        nextDrafts[row._id] = {
          attendance,
          marksObtained: attendance === ATTENDANCE_ABSENT ? '' : normalized.marksObtained,
          maxMarks: normalized.maxMarks,
        };
      });
      setDrafts(nextDrafts);
      setFieldErrors({});
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
    const nextValue = field === 'marksObtained' || field === 'maxMarks'
      ? sanitizeWholeNumberInput(value)
      : value;

    setFieldErrors((prev) => {
      const key = buildMarkEntryFieldKey(studentId, field);
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

    setDrafts((prev) => {
      const current = prev[studentId] || {};
      const next = { ...current, [field]: nextValue };
      if (field === 'attendance' && value === ATTENDANCE_ABSENT) {
        next.marksObtained = '';
      }
      return { ...prev, [studentId]: next };
    });
  };

  const focusMarkEntryField = (studentId, field) => {
    const selector = `[data-mark-entry-id="${studentId}"][data-mark-field="${field}"]`;
    const input = markEntryTableRef.current?.querySelector(selector);
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  };

  const handleSave = async () => {
    if (!canLoadGrid || !grid?.students?.length) return;

    const completedRows = grid.students.filter((row) => isMarkEntryComplete(drafts[row._id]));
    if (!completedRows.length) {
      showError('Enter marks for at least one student, or mark them absent, then save. The rest stay pending.');
      return;
    }

    const { errors, firstTarget } = validateMarkEntryDrafts(completedRows, drafts);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      if (firstTarget) {
        focusMarkEntryField(firstTarget.studentId, firstTarget.field);
      }
      const leadMessage = firstTarget
        ? `${firstTarget.studentName}: ${errors[buildMarkEntryFieldKey(firstTarget.studentId, firstTarget.field)]}`
        : 'Fix the highlighted mark fields before saving.';
      showError(leadMessage);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const entries = completedRows.map((row) => {
        const draft = drafts[row._id] || {};
        const attendance = resolveAttendance(draft.attendance);
        const normalizedMarks = attendance === ATTENDANCE_ABSENT
          ? ''
          : roundUpStoredMark(draft.marksObtained);
        const normalizedMax = roundUpStoredMark(draft.maxMarks) || DEFAULT_MAX_MARKS;
        return {
          studentId: row._id,
          attendance,
          marksObtained: normalizedMarks,
          maxMarks: normalizedMax,
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
      const pendingCount = grid.students.length - completedRows.length;
      const savedLabel = result.message || `Saved ${completedRows.length} test report(s)`;
      showSuccess(
        pendingCount > 0
          ? `${savedLabel}. ${pendingCount} student${pendingCount === 1 ? '' : 's'} left pending.`
          : savedLabel
      );
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
    setMarksFilterOp('any');
    setMarksFilterValue('');
  };

  const visibleStudents = useMemo(() => {
    const rows = grid?.students || [];
    return rows.filter((row) => matchesMarksFilter(drafts[row._id], marksFilterOp, marksFilterValue));
  }, [grid?.students, drafts, marksFilterOp, marksFilterValue]);

  const completedCount = useMemo(
    () => (grid?.students || []).filter((row) => isMarkEntryComplete(drafts[row._id])).length,
    [grid?.students, drafts]
  );

  const pendingCount = (grid?.students?.length || 0) - completedCount;
  const marksFilterNeedsValue = marksFilterOp !== 'any' && marksFilterOp !== 'pending';

  const hasFilters = Boolean(
    schoolFilter
    || deptFilter
    || sectionFilter
    || pyFilter
    || semFilter
    || subjectFilter
    || marksFilterOp !== 'any'
    || marksFilterValue
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
          <CollapsibleFilters label="Report filters">
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
          </CollapsibleFilters>

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
          <CollapsibleFilters label="Mark entry filters">
          <div className="mark-entry-filters">
            <div className="mark-entry-filters__field mark-entry-filters__month">
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
            <div className="mark-entry-filters__field">
              <label className="form-label small text-muted mb-1">School</label>
              <StyledSelect
                size="sm"
                value={schoolFilter}
                onChange={(e) => {
                  setSchoolFilter(e.target.value);
                  setDeptFilter('');
                  setSectionFilter('');
                  setSubjectFilter('');
                }}
                aria-label="Filter by school"
                placeholder="All Schools"
                options={[
                  { value: '', label: 'All Schools' },
                  ...schools.map((school) => ({
                    value: school._id,
                    label: school.name,
                  })),
                ]}
              />
            </div>
            <div className="mark-entry-filters__field">
              <label className="form-label small text-muted mb-1">Department</label>
              <StyledSelect
                size="sm"
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setSectionFilter('');
                  setSubjectFilter('');
                }}
                aria-label="Filter by department"
                placeholder="Select department"
                options={[
                  { value: '', label: 'Select department' },
                  ...filterOptions.depts.map((dept) => ({
                    value: dept,
                    label: dept,
                  })),
                ]}
              />
            </div>
            <div className="mark-entry-filters__field">
              <label className="form-label small text-muted mb-1">Section</label>
              <StyledSelect
                size="sm"
                value={sectionFilter}
                onChange={(e) => {
                  setSectionFilter(e.target.value);
                  setSubjectFilter('');
                }}
                aria-label="Filter by section"
                placeholder="Select section"
                disabled={!deptFilter}
                options={[
                  { value: '', label: 'Select section' },
                  ...filterOptions.sections.map((section) => ({
                    value: section,
                    label: section,
                  })),
                ]}
              />
            </div>
            <div className="mark-entry-filters__field">
              <label className="form-label small text-muted mb-1">PY</label>
              <StyledSelect
                size="sm"
                value={pyFilter}
                onChange={(e) => setPyFilter(e.target.value)}
                aria-label="Filter by PY"
                placeholder="All PY"
                options={[
                  { value: '', label: 'All PY' },
                  ...filterOptions.pys.map((py) => ({
                    value: String(py),
                    label: String(py),
                  })),
                ]}
              />
            </div>
            <div className="mark-entry-filters__field">
              <label className="form-label small text-muted mb-1">Semester</label>
              <StyledSelect
                size="sm"
                value={semFilter}
                onChange={(e) => {
                  setSemFilter(e.target.value);
                  setSubjectFilter('');
                }}
                aria-label="Filter by semester"
                placeholder="Select semester"
                options={[
                  { value: '', label: 'Select semester' },
                  ...filterOptions.semesters.map((sem) => ({
                    value: sem,
                    label: sem,
                  })),
                ]}
              />
            </div>
            <div className="mark-entry-filters__field">
              <label className="form-label small text-muted mb-1">Subject</label>
              <StyledSelect
                size="sm"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                aria-label="Filter by subject"
                placeholder={loadingSubjects ? 'Loading...' : 'Select subject'}
                disabled={!deptFilter || !sectionFilter || !semFilter || loadingSubjects}
                options={[
                  {
                    value: '',
                    label: loadingSubjects ? 'Loading...' : 'Select subject',
                  },
                  ...subjects.map((subject) => ({
                    value: subject._id,
                    label: subject.label,
                  })),
                ]}
              />
            </div>
            <div className="mark-entry-filters__actions">
              {hasFilters && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
                  Clear
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!canLoadGrid || !grid?.students?.length || saving}
                onClick={handleSave}
              >
                {saving ? 'Saving...' : 'Save Marks'}
              </button>
            </div>
          </div>
          </CollapsibleFilters>

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
              <div className="card-body table-responsive" ref={markEntryTableRef}>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div className="text-muted small">
                    {grid.subject?.name} ({grid.subject?.code})
                    {' · '}
                    {visibleStudents.length === grid.students.length
                      ? `${grid.students.length} student${grid.students.length === 1 ? '' : 's'}`
                      : `${visibleStudents.length} of ${grid.students.length} students`}
                    {' · '}
                    {completedCount} entered
                    {pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
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
                      <th>
                        <div className="mark-entry-marks-heading">
                          <span>Marks</span>
                          <div className="mark-entry-score-filter">
                            <StyledSelect
                              size="sm"
                              value={marksFilterOp}
                              onChange={(e) => {
                                setMarksFilterOp(e.target.value);
                                if (e.target.value === 'any' || e.target.value === 'pending') {
                                  setMarksFilterValue('');
                                }
                              }}
                              aria-label="Filter students by marks"
                              options={MARKS_FILTER_OPTIONS}
                            />
                            {marksFilterNeedsValue && (
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="form-control form-control-sm mark-entry-score-filter__value"
                                value={marksFilterValue}
                                onChange={(e) => setMarksFilterValue(sanitizeWholeNumberInput(e.target.value))}
                                onKeyDown={blockDecimalNumberKeys}
                                onWheel={blockNumberInputWheel}
                                placeholder="Score"
                                aria-label="Marks filter value"
                              />
                            )}
                          </div>
                        </div>
                      </th>
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
                    ) : visibleStudents.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          No students match this marks filter
                        </td>
                      </tr>
                    ) : (
                      visibleStudents.map((row) => {
                        const draft = drafts[row._id] || {};
                        const attendance = resolveAttendance(draft.attendance);
                        const absent = attendance === ATTENDANCE_ABSENT;
                        const maxMarks = draft.maxMarks ?? DEFAULT_MAX_MARKS;
                        const pct = computePercentage(draft.marksObtained, maxMarks, attendance);
                        const result = formatPassStatus(draft.marksObtained, maxMarks, attendance);
                        const marksError = fieldErrors[buildMarkEntryFieldKey(row._id, 'marksObtained')];
                        const maxMarksError = fieldErrors[buildMarkEntryFieldKey(row._id, 'maxMarks')];
                        return (
                          <tr key={row._id}>
                            <td>{row.rollNumber}</td>
                            <td>{row.name}</td>
                            <td>
                              <StyledSelect
                                size="sm"
                                className="toms-styled-select--table-cell"
                                value={attendance}
                                onChange={(e) => updateDraft(row._id, 'attendance', e.target.value)}
                                aria-label={`Attendance for ${row.name}`}
                                options={[
                                  { value: ATTENDANCE_PRESENT, label: 'P' },
                                  { value: ATTENDANCE_ABSENT, label: 'A' },
                                ]}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className={`form-control form-control-sm ${marksError ? 'is-invalid' : ''}`}
                                value={draft.marksObtained ?? ''}
                                onChange={(e) => updateDraft(row._id, 'marksObtained', e.target.value)}
                                onKeyDown={blockDecimalNumberKeys}
                                onWheel={blockNumberInputWheel}
                                placeholder="—"
                                disabled={absent}
                                aria-label={`Marks for ${row.name}`}
                                aria-invalid={Boolean(marksError)}
                                data-mark-entry-id={row._id}
                                data-mark-field="marksObtained"
                              />
                              {marksError && (
                                <div className="invalid-feedback d-block">{marksError}</div>
                              )}
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className={`form-control form-control-sm ${maxMarksError ? 'is-invalid' : ''}`}
                                value={maxMarks}
                                onChange={(e) => updateDraft(row._id, 'maxMarks', e.target.value)}
                                onKeyDown={blockDecimalNumberKeys}
                                onWheel={blockNumberInputWheel}
                                disabled={absent}
                                aria-label={`Max marks for ${row.name}`}
                                aria-invalid={Boolean(maxMarksError)}
                                data-mark-entry-id={row._id}
                                data-mark-field="maxMarks"
                              />
                              {maxMarksError && (
                                <div className="invalid-feedback d-block">{maxMarksError}</div>
                              )}
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
