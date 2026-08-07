import { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';
import { getSchools, getDepartments } from '../services/subjectService.js';
import {
  getTestReportFilterOptions,
  getTestReportGrid,
  bulkUpsertTestReports,
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

const SEMESTER_ORDER = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const semesterSortKey = (sem) => SEMESTER_ORDER[String(sem || '').trim()] ?? 99;

const StudentMonthlyTestReportsTab = () => {
  const [monthParts, setMonthParts] = useState(() =>
    clampMonthParts(getCurrentMonthParts())
  );
  const [classes, setClasses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [schoolFilter, setSchoolFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [pyFilter, setPyFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');

  const [grid, setGrid] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthKey = formatMonthKey(monthParts.year, monthParts.month);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const trackingMonth = parseMonthKey(STUDENT_TEST_REPORT_TRACKING_START.slice(0, 7));
  const latestMonth = getCurrentMonthParts();

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

  const canLoadGrid = Boolean(deptFilter && sectionFilter && semFilter);

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
      });
      setGrid(data);
      const nextDrafts = {};
      (data.students || []).forEach((row) => {
        nextDrafts[row._id] = {
          marksObtained: row.report?.marksObtained ?? '',
          maxMarks: row.report?.maxMarks ?? 100,
          remarks: row.report?.remarks ?? '',
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
  }, [canLoadGrid, monthKey, deptFilter, sectionFilter, semFilter, pyFilter]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const updateDraft = (studentId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!canLoadGrid || !grid?.students?.length) return;

    setSaving(true);
    try {
      const entries = grid.students.map((row) => ({
        studentId: row._id,
        marksObtained: drafts[row._id]?.marksObtained ?? '',
        maxMarks: drafts[row._id]?.maxMarks ?? 100,
        remarks: drafts[row._id]?.remarks ?? '',
      }));

      const result = await bulkUpsertTestReports({
        month: monthKey,
        department: deptFilter,
        section: sectionFilter,
        semester: semFilter,
        py: pyFilter ? Number(pyFilter) : selectedClass?.py,
        entries,
      });
      showSuccess(result.message || 'Test reports saved');
      loadGrid();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSchoolFilter('');
    setDeptFilter('');
    setSectionFilter('');
    setPyFilter('');
    setSemFilter('');
  };

  const hasFilters = Boolean(schoolFilter || deptFilter || sectionFilter || pyFilter || semFilter);

  if (loadingOptions) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <div className="row g-2 mb-3 align-items-center">
        <div className="col-md-2">
          <label className="form-label small text-muted mb-1">Month</label>
          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={atEarliestMonth}
              onClick={() => setMonthParts((prev) => shiftMonth(prev, -1))}
              aria-label="Previous month"
            >
              &lt;
            </button>
            <select
              className="form-select form-select-sm"
              value={monthKey}
              onChange={(e) => setMonthParts(parseMonthKey(e.target.value))}
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
              onClick={() => setMonthParts((prev) => shiftMonth(prev, 1))}
              aria-label="Next month"
            >
              &gt;
            </button>
          </div>
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
            onChange={(e) => setSectionFilter(e.target.value)}
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
        <div className="col-md-2">
          <label className="form-label small text-muted mb-1">Semester</label>
          <select
            className="form-select form-select-sm"
            value={semFilter}
            onChange={(e) => setSemFilter(e.target.value)}
            aria-label="Filter by semester"
          >
            <option value="">Select semester</option>
            {filterOptions.semesters.map((sem) => (
              <option key={sem} value={sem}>{sem}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2 d-flex align-items-end gap-2">
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
          Select department, section, and semester to load students for {formatMonthLabel(monthParts.year, monthParts.month)}.
        </div>
      )}

      {canLoadGrid && classes.length === 0 && (
        <div className="alert alert-warning">
          No classes assigned to your timetable. Contact an administrator if this looks wrong.
        </div>
      )}

      {canLoadGrid && loadingGrid ? (
        <LoadingSpinner />
      ) : canLoadGrid && grid ? (
        <div className="card table-card">
          <div className="card-body table-responsive">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="text-muted small">
                {grid.students.length} student{grid.students.length === 1 ? '' : 's'}
                {' · '}
                {deptFilter} {sectionFilter} · Sem {semFilter}
                {pyFilter ? ` · PY ${pyFilter}` : ''}
              </div>
            </div>
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Roll No.</th>
                  <th>Name</th>
                  <th style={{ width: '120px' }}>Marks</th>
                  <th style={{ width: '100px' }}>Out of</th>
                  <th>Remarks</th>
                  <th>Last updated</th>
                </tr>
              </thead>
              <tbody>
                {grid.students.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">
                      No active students in this class
                    </td>
                  </tr>
                ) : (
                  grid.students.map((row) => {
                    const draft = drafts[row._id] || {};
                    return (
                      <tr key={row._id}>
                        <td>{row.rollNumber}</td>
                        <td>{row.name}</td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min="0"
                            max={draft.maxMarks || 100}
                            step="0.5"
                            value={draft.marksObtained ?? ''}
                            onChange={(e) => updateDraft(row._id, 'marksObtained', e.target.value)}
                            placeholder="—"
                            aria-label={`Marks for ${row.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min="1"
                            value={draft.maxMarks ?? 100}
                            onChange={(e) => updateDraft(row._id, 'maxMarks', e.target.value)}
                            aria-label={`Max marks for ${row.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={draft.remarks ?? ''}
                            onChange={(e) => updateDraft(row._id, 'remarks', e.target.value)}
                            placeholder="Optional"
                            aria-label={`Remarks for ${row.name}`}
                          />
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
  );
};

export default StudentMonthlyTestReportsTab;
