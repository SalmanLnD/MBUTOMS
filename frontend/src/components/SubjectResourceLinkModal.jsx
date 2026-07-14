import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { getErrorMessage } from '../utils/helpers.js';

const SubjectResourceLinkModal = ({
  show,
  title,
  initialUrl = '',
  urlLabel = 'Google Drive open link',
  urlPlaceholder = 'https://drive.google.com/...',
  emptyError = 'Paste a Google Drive open link.',
  onClose,
  onSave,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return;
    setUrl(initialUrl || '');
    setError('');
  }, [show, initialUrl]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError(emptyError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(trimmed);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onClose={onClose} title={title} size="toms-modal-md">
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <label className="form-label" htmlFor="subject-resource-url">
            {urlLabel}
          </label>
          <input
            id="subject-resource-url"
            type="url"
            className="form-control"
            placeholder={urlPlaceholder}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
          />
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save link'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SubjectResourceLinkModal;
