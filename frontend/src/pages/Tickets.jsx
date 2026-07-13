import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getTickets, createTicket, updateTicketStatus } from '../services/ticketService.js';
import { getTrainers } from '../services/trainerService.js';
import { formatDateTime, formatStatus, getErrorMessage } from '../utils/helpers.js';
import {
  TICKET_TYPES,
  TICKET_STATUSES,
  TICKET_TYPE_LABELS,
  TICKET_STATUS_LABELS,
  getTicketStatusBadgeClass,
} from '../utils/ticketConstants.js';
import { ROLES } from '../utils/roles.js';

const truncateText = (text, max = 80) => {
  if (!text) return '-';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const Tickets = () => {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole(ROLES.ADMIN);

  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [createForm, setCreateForm] = useState({ raisedByTrainer: '', type: '', description: '' });
  const [updateForm, setUpdateForm] = useState({ status: '', comment: '' });

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await getTickets({
        page,
        limit: 10,
        status: statusFilter,
        type: typeFilter,
      });
      setTickets(data.tickets);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    if (!showCreateForm || !isAdmin) return;
    getTrainers({ limit: 100, sortBy: 'name', sortOrder: 'asc' })
      .then((data) => setTrainers(data.trainers || []))
      .catch(() => setTrainers([]));
  }, [showCreateForm, isAdmin]);

  const openCreateForm = () => {
    setCreateForm({ raisedByTrainer: '', type: '', description: '' });
    setShowCreateForm(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        type: createForm.type,
        description: createForm.description,
      };
      if (isAdmin) {
        payload.raisedByTrainer = createForm.raisedByTrainer;
      }
      await createTicket(payload);
      showSuccess('Ticket raised successfully');
      setShowCreateForm(false);
      setPage(1);
      fetchTickets();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const openUpdateModal = (ticket) => {
    setPendingUpdate(ticket);
    setUpdateForm({ status: ticket.status, comment: '' });
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!pendingUpdate) return;

    try {
      await updateTicketStatus(pendingUpdate._id, updateForm);
      showSuccess('Ticket status updated');
      setPendingUpdate(null);
      fetchTickets();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const requiresResolveComment = ['solving', 'closed'].includes(updateForm.status);

  return (
    <>
      <Topbar title="Support Tickets" />

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="d-flex flex-wrap gap-2">
          <select
            className="form-select w-auto"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>{TICKET_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <select
            className="form-select w-auto"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            aria-label="Filter by type"
          >
            <option value="">All Types</option>
            {TICKET_TYPES.map((type) => (
              <option key={type} value={type}>{TICKET_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateForm}>
          Raise Ticket
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="card table-card">
          <div className="card-body table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Ticket ID</th>
                  {isAdmin && <th>Raised By</th>}
                  <th>Type</th>
                  <th>Comments</th>
                  <th>Status</th>
                  <th>Raised On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center text-muted py-4">
                      No tickets found
                    </td>
                  </tr>
                ) : tickets.map((ticket) => (
                  <tr key={ticket._id}>
                    <td className="fw-medium">{ticket.ticketId}</td>
                    {isAdmin && (
                      <td>
                      <div>{ticket.trainer?.name || ticket.raisedBy?.name || '-'}</div>
                      {ticket.trainer?.employeeId ? (
                        <small className="text-muted">{ticket.trainer.employeeId}</small>
                      ) : ticket.raisedBy?.role && ticket.raisedBy.role !== ROLES.TRAINER && (
                        <small className="text-muted">Admin</small>
                      )}
                    </td>
                    )}
                    <td>{TICKET_TYPE_LABELS[ticket.type] || formatStatus(ticket.type)}</td>
                    <td>{truncateText(ticket.description)}</td>
                    <td>
                      <span className={`badge bg-${getTicketStatusBadgeClass(ticket.status)}`}>
                        {TICKET_STATUS_LABELS[ticket.status] || formatStatus(ticket.status)}
                      </span>
                    </td>
                    <td>{formatDateTime(ticket.createdAt)}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          View
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => openUpdateModal(ticket)}
                          >
                            Update
                          </button>
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

      {showCreateForm && (
        <Modal show title="Raise Ticket" onClose={() => setShowCreateForm(false)}>
          <form onSubmit={handleCreateSubmit}>
            <div className="toms-modal-body">
              {isAdmin && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="ticket-raised-by">Raised By</label>
                  <select
                    id="ticket-raised-by"
                    className="form-select"
                    value={createForm.raisedByTrainer}
                    onChange={(e) => setCreateForm({ ...createForm, raisedByTrainer: e.target.value })}
                    required
                  >
                    <option value="">Select who this ticket is for</option>
                    <option value="self">{user?.name || 'Admin'} (Myself)</option>
                    {trainers.map((trainer) => (
                      <option key={trainer._id} value={trainer._id}>
                        {trainer.name} ({trainer.employeeId})
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    Choose yourself to raise on your behalf, or select a trainer you are representing.
                  </div>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label" htmlFor="ticket-type">Issue Type</label>
                <select
                  id="ticket-type"
                  className="form-select"
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  required
                >
                  <option value="">Select issue type</option>
                  {TICKET_TYPES.map((type) => (
                    <option key={type} value={type}>{TICKET_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="ticket-description">Detailed Comments</label>
                <textarea
                  id="ticket-description"
                  className="form-control"
                  rows="5"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Describe the issue in detail"
                  required
                />
              </div>
            </div>
            <div className="toms-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">Submit Ticket</button>
            </div>
          </form>
        </Modal>
      )}

      {selectedTicket && (
        <Modal show title={`Ticket ${selectedTicket.ticketId}`} onClose={() => setSelectedTicket(null)}>
          <div className="toms-modal-body">
            <dl className="row mb-0">
              <dt className="col-sm-4">Ticket ID</dt>
              <dd className="col-sm-8">{selectedTicket.ticketId}</dd>

              <dt className="col-sm-4">Type</dt>
              <dd className="col-sm-8">{TICKET_TYPE_LABELS[selectedTicket.type]}</dd>

              <dt className="col-sm-4">Status</dt>
              <dd className="col-sm-8">
                <span className={`badge bg-${getTicketStatusBadgeClass(selectedTicket.status)}`}>
                  {TICKET_STATUS_LABELS[selectedTicket.status]}
                </span>
              </dd>

              {isAdmin && (
                <>
                  <dt className="col-sm-4">Raised By</dt>
                  <dd className="col-sm-8">
                    {selectedTicket.trainer?.name || selectedTicket.raisedBy?.name || '-'}
                    {selectedTicket.trainer?.employeeId && (
                      <span className="text-muted"> ({selectedTicket.trainer.employeeId})</span>
                    )}
                  </dd>
                </>
              )}

              <dt className="col-sm-4">Raised On</dt>
              <dd className="col-sm-8">{formatDateTime(selectedTicket.createdAt)}</dd>

              <dt className="col-sm-4">Comments</dt>
              <dd className="col-sm-8" style={{ whiteSpace: 'pre-wrap' }}>{selectedTicket.description}</dd>
            </dl>

            {selectedTicket.updates?.length > 0 && (
              <div className="mt-4">
                <h6 className="mb-3">Status Updates</h6>
                <div className="d-flex flex-column gap-3">
                  {selectedTicket.updates.map((update) => (
                    <div key={update._id} className="border rounded p-3">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <span className={`badge bg-${getTicketStatusBadgeClass(update.status)}`}>
                          {TICKET_STATUS_LABELS[update.status]}
                        </span>
                        <small className="text-muted">{formatDateTime(update.createdAt)}</small>
                      </div>
                      {update.comment ? (
                        <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>{update.comment}</p>
                      ) : (
                        <p className="mb-1 text-muted">No comment added.</p>
                      )}
                      <small className="text-muted">
                        Updated by {update.updatedBy?.name || 'Admin'}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="toms-modal-footer">
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSelectedTicket(null);
                  openUpdateModal(selectedTicket);
                }}
              >
                Update Status
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedTicket(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {pendingUpdate && (
        <Modal
          show
          title={`Update Ticket ${pendingUpdate.ticketId}`}
          onClose={() => setPendingUpdate(null)}
        >
          <form onSubmit={handleUpdateSubmit}>
            <div className="toms-modal-body">
              <div className="mb-3">
                <label className="form-label">Current Status</label>
                <div>
                  <span className={`badge bg-${getTicketStatusBadgeClass(pendingUpdate.status)}`}>
                    {TICKET_STATUS_LABELS[pendingUpdate.status]}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="ticket-status">New Status</label>
                <select
                  id="ticket-status"
                  className="form-select"
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  required
                >
                  {TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>{TICKET_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="ticket-update-comment">
                  {requiresResolveComment ? 'Resolve Comments' : 'Update Comments'}
                </label>
                <textarea
                  id="ticket-update-comment"
                  className="form-control"
                  rows="4"
                  value={updateForm.comment}
                  onChange={(e) => setUpdateForm({ ...updateForm, comment: e.target.value })}
                  placeholder={
                    requiresResolveComment
                      ? 'Describe the current situation or resolution steps'
                      : 'Optional comment about the current situation'
                  }
                  required={requiresResolveComment}
                />
                {requiresResolveComment && (
                  <div className="form-text">
                    A comment is required when marking a ticket as Solving or Closed.
                  </div>
                )}
              </div>

              <div className="mb-0">
                <label className="form-label">Original Request</label>
                <p className="text-muted small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {pendingUpdate.description}
                </p>
              </div>
            </div>
            <div className="toms-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setPendingUpdate(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">Save Update</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default Tickets;
