import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';
import AlertMessage from './AlertMessage.jsx';
import {
  getReplacementCandidates,
  resignTrainer,
  relocateTrainer,
  permanentReplaceTrainer,
} from '../services/trainerService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';

const TrainerRoleTransferModal = ({ trainer, mode, onClose, onComplete }) => {
  const isResignation = mode === 'resign';
  const isRelocation = mode === 'relocate';
  const [successorTrainerId, setSuccessorTrainerId] = useState('');
  const [resignationDate, setResignationDate] = useState(toInputDate(new Date()));
  const [effectiveDate, setEffectiveDate] = useState(toInputDate(new Date()));
  const [successorOptions, setSuccessorOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingOptions(true);
      try {
        const data = await getReplacementCandidates({
          excludeId: trainer._id,
          slotFree: 'true',
        });
        if (cancelled) return;
        const options = (data.trainers || []).map((row) => ({
          value: row._id,
          label: row.label || `${row.name} (${row.employeeId})`,
        }));
        setSuccessorOptions(options);
        if (!options.length) {
          setError('No trainers without timetable slots are available for replacement.');
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [trainer._id]);

  const title = isResignation ? 'Trainer Resignation / Exit' : isRelocation ? 'Trainer Relocation' : 'Permanent Replacement';
  const submitLabel = isResignation ? 'Confirm Resignation' : isRelocation ? 'Confirm Relocation' : 'Confirm Transfer';

  const helperText = useMemo(() => {
    if (isResignation) {
      return 'Permanent replacement is required only when the trainer still has timetable classes. If no classes remain, the exit can proceed without a replacement trainer.';
    }
    if (isRelocation) {
      return 'Permanent replacement is optional when the trainer has no assigned classes. If classes remain, a replacement trainer is required before relocation is saved.';
    }
    return 'Only trainers with no timetable slots are listed. The current trainer stays active in the system with no slots after transfer. Schedules, subjects, and CAMU credentials move to the replacement from the selected date.';
  }, [isResignation, isRelocation]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isResignation && !isRelocation && !successorTrainerId) {
      setError('Select a replacement trainer.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = isResignation || isRelocation
        ? {
          successorTrainerId: successorTrainerId || '',
          resignationDate: new Date(`${resignationDate}T12:00:00`).toISOString(),
        }
        : {
          successorTrainerId,
          effectiveDate: new Date(`${effectiveDate}T12:00:00`).toISOString(),
        };

      const result = isResignation
        ? await resignTrainer(trainer._id, payload)
        : isRelocation
          ? await relocateTrainer(trainer._id, payload)
          : await permanentReplaceTrainer(trainer._id, payload);

      onComplete(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      show
      title={title}
      onClose={onClose}
      size="toms-modal-lg"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="trainer-role-transfer-form"
            className={`btn btn-${isResignation ? 'danger' : 'primary'}`}
            disabled={submitting || loadingOptions}
          >
            {submitting ? 'Processing…' : submitLabel}
          </button>
        </>
      )}
    >
      <form id="trainer-role-transfer-form" onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <AlertMessage type="danger" message={error} />}

          <p className="text-muted small mb-3">
            {helperText}
          </p>

          <div className="mb-3">
            <label className="form-label fw-semibold">Trainer</label>
            <input
              type="text"
              className="form-control"
              value={`${trainer.name} (${trainer.employeeId})`}
              readOnly
            />
          </div>

          {!isResignation && !isRelocation && (
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="successor-trainer">
                Replacement trainer
                <span className="text-danger"> *</span>
              </label>
              <StyledSelect
                id="successor-trainer"
                value={successorTrainerId}
                onChange={(event) => setSuccessorTrainerId(event.target.value)}
                options={successorOptions}
                placeholder={loadingOptions ? 'Loading trainers…' : 'Select replacement trainer'}
                disabled={loadingOptions || submitting}
                required
              />
            </div>
          )}

          {(isResignation || isRelocation) && (
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="successor-trainer">
                Permanent replacement
                <span className="text-muted small ms-1">(optional if no timetable classes remain)</span>
              </label>
              <StyledSelect
                id="successor-trainer"
                value={successorTrainerId}
                onChange={(event) => setSuccessorTrainerId(event.target.value)}
                options={successorOptions}
                placeholder={loadingOptions ? 'Loading trainers…' : 'Select replacement trainer if needed'}
                disabled={loadingOptions || submitting}
              />
            </div>
          )}

          {isResignation || isRelocation ? (
            <div className="mb-0">
              <label className="form-label fw-semibold" htmlFor="resignation-date">
                Resignation / last working date
                <span className="text-danger"> *</span>
              </label>
              <input
                id="resignation-date"
                type="date"
                className="form-control"
                value={resignationDate}
                onChange={(event) => setResignationDate(event.target.value)}
                required
                disabled={submitting}
              />
            </div>
          ) : (
            <div className="mb-0">
              <label className="form-label fw-semibold" htmlFor="effective-date">
                Effective from date
                <span className="text-danger"> *</span>
              </label>
              <input
                id="effective-date"
                type="date"
                className="form-control"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                required
                disabled={submitting}
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default TrainerRoleTransferModal;
