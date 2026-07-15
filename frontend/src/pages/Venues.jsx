import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import VenueDetailModal from '../components/VenueDetailModal.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import VenueFormModal from '../components/VenueFormModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { usePagination } from '../hooks/usePagination.js';
import { getVenues, getVenueMappingReference, deleteVenue } from '../services/venueService.js';
import { EditIcon, TrashIcon } from '../components/icons.jsx';
import ActionIconButton from '../components/ActionIconButton.jsx';
import { getErrorMessage } from '../utils/helpers.js';

const venueTypes = {
  classroom: 'Classroom',
  lab: 'Lab',
  auditorium: 'Auditorium',
  seminar_hall: 'Seminar Hall',
  other: 'Other',
};

const VENUE_TABS = [
  { id: 'map', label: 'Campus map' },
  { id: 'ranges', label: 'Range-wise mapping' },
  { id: 'rooms', label: 'Room details' },
];

const Venues = () => {
  const { hasManagementRole, hasFullAccess } = useAuth();
  const canManage = hasManagementRole();
  const {
    page,
    setPage,
    pageSize,
    changePageSize,
    resetPage,
    pagination,
    setPagination,
  } = usePagination({ initialPageSize: 20 });

  const [activeTab, setActiveTab] = useState('map');
  const [venues, setVenues] = useState([]);
  const [mappingReference, setMappingReference] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [viewingVenue, setViewingVenue] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debouncedSearch = useDebounce(search);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      const data = await getVenues({
        page,
        limit: pageSize,
        search: debouncedSearch,
        type: typeFilter,
        isActive: 'true',
        sortBy: 'name',
        sortOrder: 'asc',
      });
      setVenues(data.venues);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'rooms') return;
    fetchVenues();
  }, [activeTab, page, pageSize, debouncedSearch, typeFilter]);

  useEffect(() => {
    getVenueMappingReference()
      .then((data) => setMappingReference(data.reference || []))
      .catch(() => setMappingReference([]));
  }, []);

  const handleDelete = async (id, name) => {
    setPendingDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteVenue(pendingDelete.id);
      showSuccess('Venue deleted successfully');
      setPendingDelete(null);
      fetchVenues();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Topbar title={canManage ? 'Venue Management' : 'Venues'} />

      <ul className="nav nav-tabs mb-3 venues-tabs" role="tablist">
        {VENUE_TABS.map((tab) => (
          <li key={tab.id} className="nav-item" role="presentation">
            <button
              type="button"
              role="tab"
              className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'map' && (
        <div className="card table-card">
          <div className="card-body">
            <div className="venue-campus-map-wrap">
              <img
                src="/images/campus-block-map.png"
                alt="Campus aerial map showing MNS Block, M Block West, M Block East, M Block North, Diploma, Civil, Mechanical, and NAB buildings"
                className="venue-campus-map"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ranges' && (
        <div className="card table-card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-sm align-middle venue-mapping-table mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Room numbers</th>
                    <th>Building / block</th>
                    <th>Floor</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {mappingReference.map((row) => (
                    <tr key={row.rooms}>
                      <td className="fw-semibold">{row.rooms}</td>
                      <td>{row.building}</td>
                      <td>{row.floor || '—'}</td>
                      <td className="text-muted small">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="card table-card">
          <div className="card-body">
            <div className="row g-2 mb-3 align-items-center">
              <div className="col-md-4">
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search room, building, or floor..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                />
              </div>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
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
                        <th>Room</th>
                        <th>Building / block</th>
                        <th>Floor</th>
                        <th>Capacity</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>{canManage ? 'Actions' : 'Details'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venues.length === 0 ? (
                        <tr><td colSpan={7} className="text-center text-muted py-4">No venues found</td></tr>
                      ) : (
                        venues.map((venue) => (
                          <tr key={venue._id}>
                            <td className="fw-medium">{venue.name}</td>
                            <td>{venue.displayBuilding || venue.building}</td>
                            <td>{venue.displayFloor || venue.floor || '—'}</td>
                            <td>{venue.capacity}</td>
                            <td>{venueTypes[venue.type] || venue.type}</td>
                            <td>
                              <span className={`badge ${venue.isActive ? 'bg-success' : 'bg-secondary'}`}>
                                {venue.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              {canManage ? (
                                <div className="btn-group btn-group-sm action-btn-group">
                                  <ActionIconButton
                                    variant="edit"
                                    icon={EditIcon}
                                    title="Edit venue"
                                    aria-label={`Edit ${venue.name}`}
                                    onClick={() => { setEditingVenue(venue); setShowModal(true); }}
                                  />
                                  {hasFullAccess() && (
                                    <ActionIconButton
                                      variant="delete"
                                      icon={TrashIcon}
                                      title="Delete venue"
                                      aria-label={`Delete ${venue.name}`}
                                      onClick={() => handleDelete(venue._id, venue.name)}
                                    />
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => setViewingVenue(venue)}
                                >
                                  View
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                  <Pagination
                    pagination={pagination}
                    onPageChange={setPage}
                    pageSize={pageSize}
                    onPageSizeChange={changePageSize}
                    showSummary
                    align="between"
                  />
              </>
            )}
          </div>
        </div>
      )}

      {showModal && canManage && (
        <VenueFormModal
          venue={editingVenue}
          onClose={(saved) => {
            setShowModal(false);
            setEditingVenue(null);
            if (saved) { showSuccess('Venue saved successfully'); fetchVenues(); }
          }}
        />
      )}

      {viewingVenue && (
        <VenueDetailModal
          venue={viewingVenue}
          onClose={() => setViewingVenue(null)}
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
