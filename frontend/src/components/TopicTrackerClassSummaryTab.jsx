import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getTopicTrackerClassSummary } from '../services/topicTrackerService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const TopicTrackerClassSummaryTab = () => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [expandedClass, setExpandedClass] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTopicTrackerClassSummary();
      setSubjects(data.subjects || []);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const visibleSubjects = useMemo(() => {
    if (!selectedSubjectId) return subjects;
    return subjects.filter((subject) => subject.subjectId === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  return (
    <div>
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-md-5">
          <label className="form-label mb-1" htmlFor="class-summary-subject">Subject</label>
          <select
            id="class-summary-subject"
            className="form-select"
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value);
              setExpandedClass('');
            }}
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.subjectId} value={subject.subjectId}>
                {subject.subjectName} ({subject.subjectCode})
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-7">
          <p className="text-muted small mb-0">
            Coverage is based on closed topic tracker entries, grouped by class
            (branch, year and section). Syllabus topics come from each subject&apos;s topic list.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading class-wise summary..." />
      ) : !visibleSubjects.length ? (
        <div className="alert alert-light border mb-0">No subjects available for this view.</div>
      ) : (
        visibleSubjects.map((subject) => (
          <div key={subject.subjectId} className="card mb-3">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <strong>{subject.subjectName}</strong>
                <span className="text-muted small ms-2">({subject.subjectCode})</span>
              </div>
              <span className="badge bg-secondary">{subject.topicCount} syllabus topics</span>
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Closed slots</th>
                    <th>Topics covered</th>
                    <th>Coverage</th>
                    <th>Avg attendance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {!subject.classes.length ? (
                    <tr>
                      <td colSpan="6" className="text-muted text-center py-3">
                        No closed topic entries yet for this subject.
                      </td>
                    </tr>
                  ) : (
                    subject.classes.map((cls) => {
                      const expandKey = `${subject.subjectId}::${cls.branchYearSection}`;
                      const isExpanded = expandedClass === expandKey;
                      return (
                        <Fragment key={expandKey}>
                          <tr>
                            <td>{cls.branchYearSection}</td>
                            <td>{cls.closedSlots}</td>
                            <td>
                              {cls.totalTopics
                                ? `${cls.coveredCount} / ${cls.totalTopics}`
                                : cls.coveredTopics.length}
                            </td>
                            <td>
                              {cls.coveragePercent != null ? (
                                <span className={`badge ${cls.coveragePercent >= 80 ? 'bg-success' : cls.coveragePercent >= 40 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                  {cls.coveragePercent}%
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>{cls.avgAttendance != null ? `${cls.avgAttendance}%` : '-'}</td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => setExpandedClass(isExpanded ? '' : expandKey)}
                              >
                                {isExpanded ? 'Hide topics' : 'View topics'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="6" className="bg-light">
                                <div className="row g-3 p-2">
                                  <div className="col-md-6">
                                    <h4 className="h6">Covered</h4>
                                    {cls.coveredTopics.length ? (
                                      <ul className="small mb-0 ps-3">
                                        {cls.coveredTopics.map((item) => (
                                          <li key={item.topic}>
                                            {item.topic}
                                            <span className="text-muted">
                                              {' '}({item.count}x{item.lastDate ? `, last ${item.lastDate}` : ''})
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-muted small mb-0">None yet</p>
                                    )}
                                  </div>
                                  <div className="col-md-6">
                                    <h4 className="h6">Not covered</h4>
                                    {cls.uncoveredTopics.length ? (
                                      <ul className="small mb-0 ps-3">
                                        {cls.uncoveredTopics.map((topic) => (
                                          <li key={topic}>{topic}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-muted small mb-0">
                                        {cls.totalTopics ? 'All syllabus topics covered' : 'No syllabus topics configured'}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default TopicTrackerClassSummaryTab;
