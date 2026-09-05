import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner.jsx';
import AlertMessage from './AlertMessage.jsx';
import TrainerFormModal from './TrainerFormModal.jsx';
import TrainerRoleTransferModal from './TrainerRoleTransferModal.jsx';
import { showSuccess } from '../utils/toast.js';
import { getTrainerById } from '../services/trainerService.js';
import { getCompOffSummary } from '../services/compOffService.js';
import { formatDate, getErrorMessage, resolveLinkedTrainerId } from '../utils/helpers.js';
import { useAuth } from '../context/AuthContext.jsx';

const TrainerDetailsPanel = ({ trainerId, canEdit = false }) => {
  const { user } = useAuth();
  const resolvedTrainerId = resolveLinkedTrainerId(trainerId);
  const ownTrainerId = resolveLinkedTrainerId(user?.trainer);
  const showCamuPassword = canEdit || Boolean(
    resolvedTrainerId && ownTrainerId && resolvedTrainerId === ownTrainerId
  );
  const [trainer, setTrainer] = useState(null);
  const [compOffSummary, setCompOffSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [transferMode, setTransferMode] = useState(null);

  const fetchTrainer = useCallback(async () => {
    if (!resolvedTrainerId) {
      setLoadError('Trainer profile is not linked to this account.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [data, compOffData] = await Promise.all([
        getTrainerById(resolvedTrainerId),
        getCompOffSummary({ trainerId: resolvedTrainerId }).catch(() => null),
      ]);
      setTrainer(data);
      setCompOffSummary(compOffData?.summary || null);
      setLoadError('');
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [resolvedTrainerId]);

  useEffect(() => {
    fetchTrainer();
  }, [fetchTrainer]);

  const handleEditClose = (saved) => {
    setShowEditModal(false);
    if (saved) {
      showSuccess('Trainer updated successfully');
      fetchTrainer();
    }
  };

  const handleTransferComplete = (result) => {
    setTransferMode(null);
    showSuccess(result?.message || 'Trainer updated successfully');
    fetchTrainer();
  };

  if (loading) return <LoadingSpinner message="Loading trainer details..." />;
  if (loadError && !trainer) return <AlertMessage message={loadError} />;
  if (!trainer) return <AlertMessage message="Trainer not found" />;

  return (
    <>
      {canEdit && trainer.employmentStatus !== 'resigned' && (
        <div className="mb-3 d-flex flex-wrap justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowEditModal(true)}>
            Edit Profile
          </button>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setTransferMode('replacement')}>
            Permanent Replacement
          </button>
          <button type="button" className="btn btn-outline-warning btn-sm" onClick={() => setTransferMode('relocate')}>
            Relocated
          </button>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setTransferMode('resign')}>
            Resignation / Exit
          </button>
        </div>
      )}

      {(trainer.employmentStatus === 'resigned' || trainer.employmentStatus === 'relocated') && (
        <div className="alert alert-warning mb-3">
          {trainer.employmentStatus === 'relocated' ? 'Relocated' : 'Resigned'}
          {trainer.resignationDate ? ` — last working day ${formatDate(trainer.resignationDate)}` : ''}
          {trainer.successorTrainer?.name
            ? `. Replaced by ${trainer.successorTrainer.name} (${trainer.successorTrainer.employeeId}).`
            : '.'}
        </div>
      )}

      {canEdit && (trainer.employmentStatus === 'resigned' || trainer.employmentStatus === 'relocated') && (
        <div className="mb-3 d-flex justify-content-end">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowEditModal(true)}>
            Edit Profile
          </button>
        </div>
      )}

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card table-card">
            <div className="card-body text-center">
              <div
                className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center mb-3"
                style={{ width: 80, height: 80, fontSize: '2rem', fontWeight: 600 }}
              >
                {trainer.name.charAt(0)}
              </div>
              <h4 className="mb-1">{trainer.name}</h4>
              <p className="text-muted mb-0">{trainer.employeeId}</p>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card table-card mb-4">
            <div className="card-body">
              <h5 className="card-title mb-3">Contact & Department</h5>
              <div className="row g-3">
                <div className="col-sm-6">
                  <label className="text-muted small">Email</label>
                  <p className="mb-0">{trainer.email || '-'}</p>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted small">Phone</label>
                  <p className="mb-0">{trainer.phone || '-'}</p>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted small">CAMU ERP ID</label>
                  <p className="mb-0">{trainer.camuErpId || '-'}</p>
                </div>
                {showCamuPassword && (
                  <div className="col-sm-6">
                    <label className="text-muted small">CAMU Password</label>
                    <p className="mb-0">{trainer.camuPassword || '-'}</p>
                  </div>
                )}
                <div className="col-sm-6">
                  <label className="text-muted small">Department</label>
                  <p className="mb-0">{trainer.department?.name || '-'}</p>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted small">Joining Date</label>
                  <p className="mb-0">{formatDate(trainer.joiningDate)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card table-card mb-4">
            <div className="card-body">
              <h5 className="card-title mb-3">Comp Off Summary</h5>
              <div className="row g-3">
                <div className="col-sm-4">
                  <label className="text-muted small">Pending Balance</label>
                  <p className="mb-0 fw-semibold">{compOffSummary?.pendingBalance ?? 0}</p>
                </div>
                <div className="col-sm-4">
                  <label className="text-muted small">Pending Records</label>
                  <p className="mb-0">{compOffSummary?.pendingRecords ?? 0}</p>
                </div>
                <div className="col-sm-4">
                  <label className="text-muted small">Closed Records</label>
                  <p className="mb-0">{compOffSummary?.closedRecords ?? 0}</p>
                </div>
                {compOffSummary?.duplicateRecords > 0 && (
                  <div className="col-12">
                    <span className="badge bg-warning text-dark">
                      {compOffSummary.duplicateRecords} duplicate comp-off row(s) flagged
                    </span>
                  </div>
                )}
                {compOffSummary?.hasMultipleEmployeeIds && (
                  <div className="col-12">
                    <span className="badge bg-info text-dark">
                      This name appears under multiple employee IDs in comp-off data
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card table-card mb-4">
            <div className="card-body">
              <h5 className="card-title mb-3">Professional Details</h5>
              <div className="row g-3">
                <div className="col-sm-4">
                  <label className="text-muted small">Experience</label>
                  <p className="mb-0">{trainer.experience} years</p>
                </div>
                <div className="col-sm-4">
                  <label className="text-muted small">Weekly Workload</label>
                  <p className="mb-0">{trainer.weeklyWorkloadHours} hrs</p>
                </div>
                <div className="col-sm-4">
                  <label className="text-muted small">Performance Score</label>
                  <p className="mb-0">{trainer.performanceScore}%</p>
                </div>
                <div className="col-12">
                  <label className="text-muted small">Skills</label>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {trainer.skills?.length > 0
                      ? trainer.skills.map((skill) => (
                          <span key={skill} className="badge bg-light text-dark border">{skill}</span>
                        ))
                      : <span className="text-muted">No skills listed</span>}
                  </div>
                </div>
                <div className="col-12">
                  <label className="text-muted small">Subjects</label>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {trainer.subjects?.length > 0
                      ? trainer.subjects.map((subject) => (
                          <span key={subject._id} className="badge bg-primary">
                            {subject.name} ({subject.code})
                          </span>
                        ))
                      : <span className="text-muted">No subjects assigned</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card table-card">
            <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h5 className="card-title mb-1">Schedule</h5>
                <p className="text-muted mb-0">
                  Weekly workload: {trainer.weeklyWorkloadHours} hrs assigned
                </p>
              </div>
              <Link to={`/trainers/${resolvedTrainerId}/schedule`} className="btn btn-primary btn-sm">
                View Full Schedule
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && (
        <TrainerFormModal trainer={trainer} onClose={handleEditClose} />
      )}

      {transferMode && (
        <TrainerRoleTransferModal
          trainer={trainer}
          mode={transferMode}
          onClose={() => setTransferMode(null)}
          onComplete={handleTransferComplete}
        />
      )}
    </>
  );
};

export default TrainerDetailsPanel;
