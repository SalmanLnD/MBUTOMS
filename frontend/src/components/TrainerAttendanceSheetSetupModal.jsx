import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import {
  getTrainerAttendanceAppsScriptSetup,
  linkTrainerAttendanceSheet,
} from '../services/attendanceService.js';
import { getErrorMessage } from '../utils/helpers.js';

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  }
};

const TrainerAttendanceSheetSetupModal = ({
  show,
  initialUrl = '',
  onClose,
  onLinked,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [setup, setSetup] = useState(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(initialUrl);
  const [copyHint, setCopyHint] = useState('');

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    setError('');
    setSpreadsheetUrl(initialUrl);
    getTrainerAttendanceAppsScriptSetup()
      .then(setSetup)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [show, initialUrl]);

  const handleCopy = async (text, label) => {
    await copyText(text);
    setCopyHint(`${label} copied`);
    window.setTimeout(() => setCopyHint(''), 2000);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await linkTrainerAttendanceSheet(spreadsheetUrl.trim());
      onLinked();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      title="Link Trainer Attendance Google Sheet"
      onClose={onClose}
      size="toms-modal-lg"
      scrollable
    >
      <form onSubmit={handleSave}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {copyHint && <div className="alert alert-success py-2">{copyHint}</div>}

          {loading ? (
            <div className="text-muted">Loading setup...</div>
          ) : setup && (
            <>
              <p className="text-muted small">
                One continuous attendance sheet refreshes every five minutes and automatically
                adds later months.
              </p>
              <ol className="small mb-3">
                {setup.steps.map((step) => (
                  <li key={step} className="mb-1">{step}</li>
                ))}
              </ol>
              {setup.note && <div className="alert alert-warning small">{setup.note}</div>}

              {[
                ['attendance-export-url', 'Export API URL', setup.exportUrl, 'API URL'],
                ['attendance-api-key', 'API key', setup.apiKey, 'API key'],
              ].map(([id, label, value, copyLabel]) => (
                <div className="mb-3" key={id}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label mb-0" htmlFor={id}>{label}</label>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => handleCopy(value, copyLabel)}
                    >
                      Copy
                    </button>
                  </div>
                  <input
                    id={id}
                    className="form-control form-control-sm font-monospace"
                    value={value}
                    readOnly
                  />
                </div>
              ))}

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label mb-0" htmlFor="attendance-apps-script">
                    Apps Script
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleCopy(setup.script, 'Apps Script')}
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  id="attendance-apps-script"
                  className="form-control font-monospace small"
                  rows="12"
                  value={setup.script}
                  readOnly
                />
              </div>

              <div>
                <label className="form-label" htmlFor="attendance-sheet-url">
                  Your Google Sheet URL
                </label>
                <input
                  id="attendance-sheet-url"
                  type="url"
                  className="form-control"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={spreadsheetUrl}
                  onChange={(event) => setSpreadsheetUrl(event.target.value)}
                  required
                />
              </div>
            </>
          )}
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || saving || !spreadsheetUrl.trim()}
          >
            {saving ? 'Saving...' : 'Save link'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TrainerAttendanceSheetSetupModal;
