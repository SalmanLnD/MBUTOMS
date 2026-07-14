import { useCallback, useEffect, useState } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import TopicTrackerSpreadsheet from '../components/TopicTrackerSpreadsheet.jsx';
import TopicTrackerSheetSetupModal from '../components/TopicTrackerSheetSetupModal.jsx';
import TopicTrackerClassSummaryTab from '../components/TopicTrackerClassSummaryTab.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getTopicTrackerOverview, getTopicTrackerSheetStatus } from '../services/topicTrackerService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import { showError } from '../utils/toast.js';
import { getTopicTrackerStatusBadgeClass } from '../utils/topicTrackerConstants.js';
import { ROLES } from '../utils/roles.js';
import { SheetIcon, ExternalLinkIcon } from '../components/icons.jsx';

const TopicTracker = () => {
  const { hasRole, user } = useAuth();
  const isTrainer = hasRole(ROLES.TRAINER);
  const isCoordinator = user?.role === ROLES.SUBJECT_COORDINATOR;
  // Exact role check — subject coordinators must not get campus_manager sheet parity here.
  const canManageSheets = [ROLES.ADMIN, ROLES.MANAGER, ROLES.CAMPUS_MANAGER].includes(user?.role);
  const showOverview = canManageSheets || isCoordinator;
  const hasLinkedTrainer = Boolean(user?.trainer);
  const canOpenOwnTracker = isTrainer || (isCoordinator && hasLinkedTrainer);

  const [activeTab, setActiveTab] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => toInputDate(new Date()));
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  const loadOverview = useCallback(async () => {
    if (!showOverview || activeTab !== 'day') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getTopicTrackerOverview(selectedDate);
      setOverview(data);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, showOverview, activeTab]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!canManageSheets) return;
    getTopicTrackerSheetStatus()
      .then(setSheetStatus)
      .catch(() => setSheetStatus(null));
  }, [canManageSheets, sheetModalOpen]);

  const openSpreadsheet = ({ subjectId, trainerId, title }) => {
    setSpreadsheet({
      date: selectedDate,
      subjectId,
      trainerId,
      title,
    });
  };

  const handleTrainerOpen = () => {
    openSpreadsheet({
      subjectId: undefined,
      trainerId: user?.trainer,
      title: `My Topic Tracker — ${selectedDate}`,
    });
  };

  return (
    <>
      <Topbar title="Topic Tracker" />

      {showOverview && (
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'day' ? 'active' : ''}`}
              onClick={() => setActiveTab('day')}
            >
              Day overview
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'class' ? 'active' : ''}`}
              onClick={() => setActiveTab('class')}
            >
              Class-wise summary
            </button>
          </li>
        </ul>
      )}

      {activeTab === 'day' && (
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
          <div>
            <label className="form-label mb-1" htmlFor="topic-tracker-date">Date</label>
            <input
              id="topic-tracker-date"
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="d-flex flex-wrap gap-2">
            {canOpenOwnTracker && (
              <button type="button" className="btn btn-primary" onClick={handleTrainerOpen}>
                Open my tracker
              </button>
            )}

            {canManageSheets && (
              <>
                {sheetStatus?.spreadsheetUrl && (
                  <a
                    href={sheetStatus.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
                  >
                    <ExternalLinkIcon size={16} />
                    Open linked sheet
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
                  onClick={() => setSheetModalOpen(true)}
                >
                  <SheetIcon size={16} />
                  Link Google Sheet
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showOverview && activeTab === 'class' && (
        <div className="card table-card">
          <div className="card-body">
            <TopicTrackerClassSummaryTab refreshKey={summaryRefreshKey} />
          </div>
        </div>
      )}

      {showOverview && activeTab === 'day' && (
        <>
          <h2 className="h6 fw-semibold mb-3">Day-wise pending by subject</h2>
          {loading ? (
            <LoadingSpinner message="Loading overview..." />
          ) : !overview?.subjects?.length ? (
            <div className="alert alert-light border">No scheduled sessions for this date.</div>
          ) : (
            overview.subjects.map((subject) => (
              <div key={subject.subjectId} className="card mb-3">
                <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <strong>{subject.subjectName}</strong>
                    <span className="text-muted small ms-2">({subject.subjectCode})</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge ${subject.pendingSlots || subject.totalPending ? 'bg-warning text-dark' : 'bg-success'}`}>
                      {subject.pendingSlots ?? subject.totalPending ?? 0} pending
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => openSpreadsheet({
                        subjectId: subject.subjectId,
                        title: `${subject.subjectName} — ${selectedDate}`,
                      })}
                    >
                      Open all slots
                    </button>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Trainer</th>
                        <th>Allotted slots</th>
                        <th>Pending</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {subject.trainers.map((trainer) => {
                        const allotted = Number(
                          trainer.allottedSlots ?? trainer.totalSlots ?? 0
                        );
                        const pending = Number(trainer.pendingSlots ?? 0);
                        return (
                          <tr key={trainer.trainerId}>
                            <td>{trainer.trainerName}</td>
                            <td>{allotted}</td>
                            <td>{pending}</td>
                            <td>
                              <span className={`badge ${getTopicTrackerStatusBadgeClass(pending ? 'pending' : 'closed')}`}>
                                {pending ? 'Pending' : 'Closed'}
                              </span>
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openSpreadsheet({
                                  subjectId: subject.subjectId,
                                  trainerId: trainer.trainerId,
                                  title: `${trainer.trainerName} — ${subject.subjectName} — ${selectedDate}`,
                                })}
                              >
                                Open tracker
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {!showOverview && canOpenOwnTracker && (
        <div className="card table-card">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h2 className="h6 fw-semibold mb-0">My class-wise summary</h2>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleTrainerOpen}>
                Update today&apos;s slots
              </button>
            </div>
            <TopicTrackerClassSummaryTab
              mine
              refreshKey={summaryRefreshKey}
              showSubjectFilter={false}
              emptyMessage={"No class coverage yet. Use Update today's slots to save closed sessions."}
            />
          </div>
        </div>
      )}

      {spreadsheet && (
        <TopicTrackerSpreadsheet
          show
          date={spreadsheet.date}
          subjectId={spreadsheet.subjectId}
          trainerId={spreadsheet.trainerId}
          title={spreadsheet.title}
          canCloseEntries
          onClose={() => {
            setSpreadsheet(null);
            setSummaryRefreshKey((key) => key + 1);
            if (showOverview && activeTab === 'day') loadOverview();
          }}
        />
      )}

      {sheetModalOpen && (
        <TopicTrackerSheetSetupModal
          show
          initialUrl={sheetStatus?.spreadsheetUrl || ''}
          onClose={() => setSheetModalOpen(false)}
          onLinked={() => {
            setSheetModalOpen(false);
            getTopicTrackerSheetStatus().then(setSheetStatus).catch(() => {});
          }}
        />
      )}
    </>
  );
};

export default TopicTracker;
