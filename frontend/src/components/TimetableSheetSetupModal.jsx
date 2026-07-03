import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { getTimetableAppsScriptSetup, linkTimetableSheet } from '../services/sheetsService.js';
import { getErrorMessage } from '../utils/helpers.js';

const copyText = async (text, onCopied) => {
  try {
    await navigator.clipboard.writeText(text);
    onCopied();
  } catch {
    // Fallback for older browsers
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
    onCopied();
  }
};

const TimetableSheetSetupModal = ({ show, initialUrl = '', onClose, onLinked }) => {
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
    getTimetableAppsScriptSetup()
      .then((data) => setSetup(data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [show, initialUrl]);

  const handleCopy = async (text, label) => {
    await copyText(text, () => {
      setCopyHint(`${label} copied`);
      setTimeout(() => setCopyHint(''), 2000);
    });
  };

  const handleSaveLink = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await linkTimetableSheet(spreadsheetUrl.trim());
      onLinked();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} title="Link Google Sheet (Apps Script)" onClose={onClose} size="toms-modal-lg" scrollable>
      <form onSubmit={handleSaveLink}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {copyHint && <div className="alert alert-success py-2">{copyHint}</div>}

          {loading ? (
            <div className="text-muted">Loading setup...</div>
          ) : setup && (
            <>
              <p className="text-muted small">
                No Workspace admin needed. The sheet pulls timetable data from TOMS every 5 minutes
                (or when you use menu <strong>TOMS Timetable → Refresh now</strong>).
              </p>

              <ol className="small mb-3">
                {setup.steps.map((step) => (
                  <li key={step} className="mb-1">{step}</li>
                ))}
              </ol>

              {setup.note && (
                <div className="alert alert-warning small">{setup.note}</div>
              )}

              {setup.exportUrl?.includes('localhost') && (
                <div className="alert alert-danger small">
                  Export URL still points to localhost. Set API_PUBLIC_URL in backend .env
                  to your ngrok https URL, restart the backend, then reopen this dialog and
                  copy the script again.
                </div>
              )}

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label mb-0" htmlFor="export-url">Export API URL</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleCopy(setup.exportUrl, 'API URL')}
                  >
                    Copy URL
                  </button>
                </div>
                <input id="export-url" className="form-control form-control-sm" value={setup.exportUrl} readOnly />
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label mb-0" htmlFor="api-key">API key (already in script below)</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleCopy(setup.apiKey, 'API key')}
                  >
                    Copy key
                  </button>
                </div>
                <input id="api-key" className="form-control form-control-sm font-monospace" value={setup.apiKey} readOnly />
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label mb-0" htmlFor="apps-script">Apps Script</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleCopy(setup.script, 'Apps Script')}
                  >
                    Copy script
                  </button>
                </div>
                <textarea
                  id="apps-script"
                  className="form-control font-monospace small"
                  rows={12}
                  value={setup.script}
                  readOnly
                />
              </div>

              <div className="mb-0">
                <label className="form-label" htmlFor="sheet-url">Your Google Sheet URL</label>
                <input
                  id="sheet-url"
                  type="url"
                  className="form-control"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value)}
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
          <button type="submit" className="btn btn-primary" disabled={loading || saving || !spreadsheetUrl.trim()}>
            {saving ? 'Saving...' : 'Save link'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TimetableSheetSetupModal;
