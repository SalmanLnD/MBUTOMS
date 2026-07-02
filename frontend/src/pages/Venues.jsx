import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import VenueFormModal from '../components/VenueFormModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { getVenues, deleteVenue } from '../services/venueService.js';
import { formatStatus, getErrorMessage } from '../utils/helpers.js';

const venueTypes = {
  classroom: 'Classroom',
  lab: 'Lab',
  auditorium: 'Auditorium',
  seminar_hall: 'Seminar Hall',
  other: 'Other',
};

const Venues = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin', 'campus_manager');

  const [venues, setVenues] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debouncedSearch = useDebounce(search);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      const data = await getVenues({ page, limit: 10, search: debouncedSearch, type: typeFilter });
      setVenues(data.venues);
      setPagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, [page, debouncedSearch, typeFilter]);

  const handleDelete = async (id, name) => {
    setPendingDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteVenue(pendingDelete.id);
      setSuccess('Venue deleted successfully');
      setPendingDelete(null);
      fetchVenues();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Topbar title="Venue Management" />
      <AlertMessage message={error} onClose={() => setError('')} />
      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />

      <div className="card table-card">
        <div className="card-body">
          <div className="row g-2 mb-3 align-items-center">
            <div className="col-md-4">
              <input
                type="search"
                className="form-control"
                placeholder="Search venues..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Types</option>
                {Object.entries(venueTypes).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            {canManage && (
              <div className="col-md-5 text-md-end">
                <button className="btn btn-primary" onClick={() => { setEditingVenue(null); setShowModal(true); }}>
                  + Add Venue
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th>
                      <th>Building</th>
                      <th>Floor</th>
                      <th>Capacity</th>
                      <th>Type</th>
                      <th>Status</th>
                      {canManage && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {venues.length === 0 ? (
                      <tr><td colSpan={canManage ? 7 : 6} className="text-center text-muted py-4">No venues found</td></tr>
                    ) : (
                      venues.map((venue) => (
                        <tr key={venue._id}>
                          <td className="fw-medium">{venue.name}</td>
                          <td>{venue.building}</td>
                          <td>{venue.floor || '-'}</td>
                          <td>{venue.capacity}</td>
                          <td>{venueTypes[venue.type] || venue.type}</td>
                          <td>
                            <span className={`badge ${venue.isActive ? 'bg-success' : 'bg-secondary'}`}>
                              {venue.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {canManage && (
                            <td>
                              <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-secondary" onClick={() => { setEditingVenue(venue); setShowModal(true); }}>
                                  Edit
                                </button>
                                {hasRole('admin') && (
                                  <button className="btn btn-outline-danger" onClick={() => handleDelete(venue._id, venue.name)}>
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      {showModal && (
        <VenueFormModal
          venue={editingVenue}
          onClose={(saved) => {
            setShowModal(false);
            setEditingVenue(null);
            if (saved) { setSuccess('Venue saved successfully'); fetchVenues(); }
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Venue"
          message={`Delete venue "${pendingDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default Venues;
