import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import { showSuccess } from '../utils/toast.js';
import TrainerFormModal from '../components/TrainerFormModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getTrainerById } from '../services/trainerService.js';
import { formatDate, getErrorMessage } from '../utils/helpers.js';

const TrainerProfile = () => {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'campus_manager');
  const [trainer, setTrainer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchTrainer = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrainerById(id);
      setTrainer(data);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  if (loading) return <LoadingSpinner message="Loading trainer profile..." />;
  if (loadError && !trainer) return <AlertMessage message={loadError} />;
  if (!trainer) return <AlertMessage message="Trainer not found" />;

  return (
    <>
      <Topbar title="Trainer Profile" />

      <div className="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <Link to="/trainers" className="btn btn-link text-decoration-none ps-0">
          ← Back to Trainers
        </Link>
        {canEdit && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowEditModal(true)}>
            Edit Profile
          </button>
        )}
      </div>

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
                {canEdit && (
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
                      ? trainer.subjects.map((s) => (
                          <span key={s._id} className="badge bg-primary">{s.name} ({s.code})</span>
                        ))
                      : <span className="text-muted">No subjects assigned</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card table-card">
            <div className="card-body d-flex justify-content-between align-items-center">
              <div>
                <h5 className="card-title mb-1">Schedule</h5>
                <p className="text-muted mb-0">
                  Weekly workload: {trainer.weeklyWorkloadHours} hrs assigned
                </p>
              </div>
              <Link to={`/trainers/${id}/schedule`} className="btn btn-primary btn-sm">
                View Full Schedule
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && (
        <TrainerFormModal trainer={trainer} onClose={handleEditClose} />
      )}
    </>
  );
};

export default TrainerProfile;
