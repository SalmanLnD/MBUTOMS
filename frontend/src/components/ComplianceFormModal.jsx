import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { createCompliance } from '../services/plpService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';

const ComplianceFormModal = ({
  show,
  trainers = [],
  onClose,
  onCreated,
}) => {
  const [trainerId, setTrainerId] = useState('');
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return;
    setTrainerId('');
    setDate(toInputDate(new Date()));
    setRemark('');
    setError('');
  }, [show]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!trainerId) {
      setError('Select a trainer');
      return;
    }
    if (!date) {
      setError('Date is required');
      return;
    }
    if (!remark.trim()) {
      setError('Remark is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await createCompliance({
        trainerId,
        date,
        remark: remark.trim(),
      });
      onCreated(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} title="Add Compliance" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="mb-3">
            <label className="form-label" htmlFor="compliance-trainer">Trainer</label>
            <select
              id="compliance-trainer"
              className="form-select"
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              required
            >
              <option value="">Select trainer</option>
              {trainers.map((trainer) => (
                <option key={trainer._id} value={trainer._id}>
                  {trainer.name}
                  {trainer.employeeId ? ` (${trainer.employeeId})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="compliance-date">Date</label>
            <input
              id="compliance-date"
              type="date"
              className="form-control"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="mb-0">
            <label className="form-label" htmlFor="compliance-remark">Remark</label>
            <textarea
              id="compliance-remark"
              className="form-control"
              rows={4}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Describe the compliance issue"
              required
            />
            <div className="form-text">
              Each compliance record deducts 1 point from the trainer&apos;s monthly compliance
              score (default 5).
            </div>
          </div>
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Add compliance'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ComplianceFormModal;
