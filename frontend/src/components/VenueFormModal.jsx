import { useState, useEffect } from 'react';
import { createVenue, updateVenue } from '../services/venueService.js';
import { getErrorMessage } from '../utils/helpers.js';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';

const emptyForm = {
  name: '',
  building: '',
  floor: '',
  capacity: 30,
  type: 'classroom',
  isActive: true,
};

const VenueFormModal = ({ venue, onClose }) => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(venue);

  useEffect(() => {
    if (venue) {
      setForm({
        name: venue.name || '',
        building: venue.building || '',
        floor: venue.floor || '',
        capacity: venue.capacity || 30,
        type: venue.type || 'classroom',
        isActive: venue.isActive !== false,
      });
    }
  }, [venue]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = { ...form, capacity: Number(form.capacity) };

    try {
      if (isEdit) {
        await updateVenue(venue._id, payload);
      } else {
        await createVenue(payload);
      }
      onClose(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show title={isEdit ? 'Edit Venue' : 'Add Venue'} onClose={() => onClose(false)}>
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Venue Name *</label>
                  <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Building *</label>
                  <input name="building" className="form-control" value={form.building} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Floor</label>
                  <input name="floor" className="form-control" value={form.floor} onChange={handleChange} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Capacity *</label>
                  <input type="number" name="capacity" className="form-control" min="1" value={form.capacity} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Type</label>
                  <StyledSelect
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    options={[
                      { value: 'classroom', label: 'Classroom' },
                      { value: 'lab', label: 'Lab' },
                      { value: 'auditorium', label: 'Auditorium' },
                      { value: 'seminar_hall', label: 'Seminar Hall' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <div className="form-check">
                    <input type="checkbox" name="isActive" className="form-check-input" id="venueActive" checked={form.isActive} onChange={handleChange} />
                    <label className="form-check-label" htmlFor="venueActive">Active</label>
                  </div>
                </div>
              </div>
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default VenueFormModal;
