import { useCallback, useEffect, useState } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import TopicTrackerSpreadsheet from '../components/TopicTrackerSpreadsheet.jsx';
import TopicTrackerSheetSetupModal from '../components/TopicTrackerSheetSetupModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getTopicTrackerOverview, getTopicTrackerSheetStatus } from '../services/topicTrackerService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import { showError } from '../utils/toast.js';
import { getTopicTrackerStatusBadgeClass } from '../utils/topicTrackerConstants.js';
import { ROLES } from '../utils/roles.js';
import { SheetIcon, ExternalLinkIcon } from '../components/icons.jsx';

const TopicTracker = () => {
  const { hasRole, hasFullAccess, user } = useAuth();
  const isTrainer = hasRole(ROLES.TRAINER);
  const isCoordinator = hasRole(ROLES.SUBJECT_COORDINATOR);
  const canManageSheets = hasFullAccess();
  const showOverview = canManageSheets || isCoordinator;

  const [selectedDate, setSelectedDate] = useState(() => toInputDate(new Date()));
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState(null);

  const loadOverview = useCallback(async () => {
    if (!showOverview) {
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
  }, [selectedDate, showOverview]);

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
          {isTrainer && (
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

      {showOverview && (
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
                    <span className={`badge ${subject.totalPending ? 'bg-warning text-dark' : 'bg-success'}`}>
                      {subject.totalPending} pending
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
                        <th>Slots</th>
                        <th>Pending</th>
                        <th>Closed</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {subject.trainers.map((trainer) => (
                        <tr key={trainer.trainerId}>
                          <td>{trainer.trainerName}</td>
                          <td>{trainer.totalSlots}</td>
                          <td>{trainer.pendingSlots}</td>
                          <td>{trainer.closedSlots}</td>
                          <td>
                            <span className={`badge ${getTopicTrackerStatusBadgeClass(trainer.pendingSlots ? 'pending' : 'closed')}`}>
                              {trainer.pendingSlots ? 'Pending' : 'Closed'}
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {!showOverview && isTrainer && (
        <div className="alert alert-info">
          Select a date and click <strong>Open my tracker</strong> to fill slot-wise topic entries for that day.
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
            if (showOverview) loadOverview();
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
