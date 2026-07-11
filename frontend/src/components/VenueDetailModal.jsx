import Modal from './Modal.jsx';

const venueTypes = {
  classroom: 'Classroom',
  lab: 'Lab',
  auditorium: 'Auditorium',
  seminar_hall: 'Seminar Hall',
  other: 'Other',
};

const VenueDetailModal = ({ venue, onClose }) => {
  if (!venue) return null;

  return (
    <Modal show title={`Room ${venue.name}`} onClose={onClose} size="toms-modal-lg">
      <div className="toms-modal-body">
        <dl className="row mb-0 venue-detail-list">
          <dt className="col-sm-4">Room number</dt>
          <dd className="col-sm-8">{venue.name}</dd>

          <dt className="col-sm-4">Building / block</dt>
          <dd className="col-sm-8">{venue.displayBuilding || venue.building || '—'}</dd>

          <dt className="col-sm-4">Floor</dt>
          <dd className="col-sm-8">{venue.displayFloor || venue.floor || '—'}</dd>

          <dt className="col-sm-4">Location</dt>
          <dd className="col-sm-8">{venue.locationSummary || '—'}</dd>

          <dt className="col-sm-4">Capacity</dt>
          <dd className="col-sm-8">{venue.capacity}</dd>

          <dt className="col-sm-4">Type</dt>
          <dd className="col-sm-8">{venueTypes[venue.type] || venue.type}</dd>

          <dt className="col-sm-4">Status</dt>
          <dd className="col-sm-8">
            <span className={`badge ${venue.isActive ? 'bg-success' : 'bg-secondary'}`}>
              {venue.isActive ? 'Active' : 'Inactive'}
            </span>
          </dd>
        </dl>
      </div>
      <div className="toms-modal-footer d-flex justify-content-end">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default VenueDetailModal;
