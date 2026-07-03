import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getLeaves, createLeave, updateLeave, deleteLeave, previewAffectedSchedules } from '../services/leaveService.js';
import { getTrainers } from '../services/trainerService.js';
import { formatDate, formatStatus, getErrorMessage, toInputDate } from '../utils/helpers.js';
import { formatTimeRange } from '../utils/scheduleUtils.js';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const Leaves = () => {
  const { hasRole } = useAuth();
  const canApprove = hasRole('admin', 'campus_manager');

  const [leaves, setLeaves] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [form, setForm] = useState({
    trainer: '',
    startDate: toInputDate(new Date()),
    endDate: toInputDate(new Date()),
    reason: '',
  });
  const [preview, setPreview] = useState(null);
  const [pendingCancel, setPendingCancel] = useState(null);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const data = await getLeaves({ page, limit: 10, status: statusFilter });
      setLeaves(data.leaves);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); }, [page, statusFilter]);

  useEffect(() => {
    if (!showForm || !canApprove) return;
    getTrainers({ limit: 100, sortBy: 'name', sortOrder: 'asc' })
      .then((d) => setTrainers(d.trainers || []))
      .catch(() => setTrainers([]));
  }, [showForm, canApprove]);

  const openLeaveForm = () => {
    setForm({
      trainer: '',
      startDate: toInputDate(new Date()),
      endDate: toInputDate(new Date()),
      reason: '',
    });
    setPreview(null);
    setShowForm(true);
  };

  const closeLeaveForm = () => {
    setShowForm(false);
    setPreview(null);
  };

  useEffect(() => {
    if (!showForm || !form.startDate || !form.endDate) return;
    // Preview only works when a trainer context exists (trainer role)
    if (hasRole('admin', 'campus_manager') && !form.trainer) {
      setPreview(null);
      return;
    }
    const loadPreview = async () => {
      try {
        const params = { startDate: form.startDate, endDate: form.endDate };
        if (form.trainer) params.trainer = form.trainer;
        const data = await previewAffectedSchedules(params);
        setPreview(data);
      } catch {
        setPreview(null);
      }
    };
    loadPreview();
  }, [form.startDate, form.endDate, form.trainer, showForm, hasRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createLeave(form);
      showSuccess('Leave application submitted');
      closeLeaveForm();
      fetchLeaves();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await updateLeave(id, { status });
      showSuccess(`Leave ${status}`);
      fetchLeaves();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const handleDelete = async (id) => {
    setPendingCancel(id);
  };

  const handleConfirmDelete = async () => {
    if (!pendingCancel) return;
    try {
      await deleteLeave(pendingCancel);
      showSuccess('Leave cancelled');
      setPendingCancel(null);
      fetchLeaves();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Topbar title="Leave Management" />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <select className="form-select w-auto" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={openLeaveForm}>Apply Leave</button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card table-card">
          <div className="card-body table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Trainer</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Affected Classes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr><td colSpan="7" className="text-center text-muted py-4">No leave records</td></tr>
                ) : leaves.map((leave) => (
                  <tr key={leave._id}>
                    <td className="fw-medium">{leave.trainer?.name}</td>
                    <td>{formatDate(leave.startDate)}</td>
                    <td>{formatDate(leave.endDate)}</td>
                    <td>{leave.reason}</td>
                    <td>{leave.affectedSchedules?.length || 0}</td>
                    <td><span className={`badge bg-${leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'danger' : 'warning'}`}>{formatStatus(leave.status)}</span></td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        {canApprove && leave.status === 'pending' && (
                          <>
                            <button className="btn btn-outline-success" onClick={() => handleApprove(leave._id, 'approved')}>Approve</button>
                            <button className="btn btn-outline-danger" onClick={() => handleApprove(leave._id, 'rejected')}>Reject</button>
                          </>
                        )}
                        {leave.status === 'pending' && (
                          <button className="btn btn-outline-secondary" onClick={() => handleDelete(leave._id)}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}

      {showForm && (
        <Modal show title="Apply for Leave" onClose={closeLeaveForm}>
          <form onSubmit={handleSubmit}>
            <div className="toms-modal-body">
              {canApprove && (
                <div className="mb-3">
                  <label className="form-label">Trainer</label>
                  <select
                    className="form-select"
                    value={form.trainer}
                    onChange={(e) => setForm({ ...form, trainer: e.target.value })}
                    required
                  >
                    <option value="">Select trainer</option>
                    {trainers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-control" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
              <div className="mb-3">
                <label className="form-label">End Date</label>
                <input type="date" className="form-control" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              </div>
              <div className="mb-3">
                <label className="form-label">Reason</label>
                <textarea className="form-control" rows="3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
              </div>
              {preview && (
                <div className="alert alert-info mb-0">
                  <strong>{preview.count}</strong> class(es) will be affected.
                  {preview.schedules?.map((s) => (
                    <div key={s._id} className="small mt-1">
                      {formatDate(s.date)} {formatTimeRange(s.startTime, s.endTime)} — {s.department} {s.section}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="toms-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeLeaveForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">Submit</button>
            </div>
          </form>
        </Modal>
      )}

      {pendingCancel && (
        <ConfirmModal
          show
          title="Cancel Leave Request"
          message="Cancel this leave request? This action cannot be undone."
          confirmLabel="Cancel Leave"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingCancel(null)}
        />
      )}
    </>
  );
};

export default Leaves;
