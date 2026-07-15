import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getTopicTrackerClassSummary } from '../services/topicTrackerService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const TopicTrackerClassSummaryTab = ({
  mine = false,
  refreshKey = 0,
  showSubjectFilter = true,
  emptyMessage = 'No class coverage data yet for your subjects.',
}) => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTrainerKey, setSelectedTrainerKey] = useState('');
  const [expandedClass, setExpandedClass] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTopicTrackerClassSummary(mine ? { mine: true } : {});
      setSubjects(data.subjects || []);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [mine]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshKey]);

  const visibleSubjects = useMemo(() => {
    if (!selectedSubjectId) return subjects;
    return subjects.filter((subject) => subject.subjectId === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  const trainerOptions = useMemo(() => {
    const trainers = new Map();
    visibleSubjects.forEach((subject) => {
      subject.classes.forEach((cls) => {
        const key = cls.trainerKey || cls.trainerId || cls.trainerName;
        if (key) trainers.set(key, cls.trainerName || 'Unassigned trainer');
      });
    });
    return [...trainers.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [visibleSubjects]);

  return (
    <div>
      {showSubjectFilter && (
        <div className="row g-2 mb-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label mb-1" htmlFor="class-summary-subject">Subject</label>
            <select
              id="class-summary-subject"
              className="form-select"
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedTrainerKey('');
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
          <div className="col-md-4">
            <label className="form-label mb-1" htmlFor="class-summary-trainer">Trainer</label>
            <select
              id="class-summary-trainer"
              className="form-select"
              value={selectedTrainerKey}
              onChange={(e) => {
                setSelectedTrainerKey(e.target.value);
                setExpandedClass('');
              }}
            >
              <option value="">All trainers</option>
              {trainerOptions.map((trainer) => (
                <option key={trainer.key} value={trainer.key}>{trainer.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <p className="text-muted small mb-0">
              Coverage is based on closed topic tracker entries, grouped by trainer and class.
            </p>
          </div>
        </div>
      )}

      {!showSubjectFilter && (
        <p className="text-muted small mb-3">
          Your class-wise topic coverage from closed tracker entries.
        </p>
      )}

      {loading ? (
        <LoadingSpinner message="Loading class-wise summary..." />
      ) : !visibleSubjects.length ? (
        <div className="alert alert-light border mb-0">{emptyMessage}</div>
      ) : (
        visibleSubjects.map((subject) => {
          const visibleClasses = selectedTrainerKey
            ? subject.classes.filter(
              (cls) => (cls.trainerKey || cls.trainerId || cls.trainerName) === selectedTrainerKey
            )
            : subject.classes;
          return (
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
                    <th>Trainer</th>
                    <th>Class</th>
                    <th>Closed slots</th>
                    <th>Topics covered</th>
                    <th>Coverage</th>
                    <th>Avg attendance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {!visibleClasses.length ? (
                    <tr>
                      <td colSpan="7" className="text-muted text-center py-3">
                        No closed topic entries found for this subject and trainer.
                      </td>
                    </tr>
                  ) : (
                    visibleClasses.map((cls) => {
                      const trainerKey = cls.trainerKey || cls.trainerId || cls.trainerName;
                      const expandKey = `${subject.subjectId}::${trainerKey}::${cls.branchYearSection}`;
                      const isExpanded = expandedClass === expandKey;
                      return (
                        <Fragment key={expandKey}>
                          <tr>
                            <td>{cls.trainerName || 'Unassigned trainer'}</td>
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
                              <td colSpan="7" className="bg-light">
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
          );
        })
      )}
    </div>
  );
};

export default TopicTrackerClassSummaryTab;
