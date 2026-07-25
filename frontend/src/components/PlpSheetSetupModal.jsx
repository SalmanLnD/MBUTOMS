import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { getPlpAppsScriptSetup, linkPlpSheet } from '../services/plpService.js';
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

const PlpSheetSetupModal = ({ show, initialUrl = '', onClose, onLinked }) => {
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
    getPlpAppsScriptSetup()
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
      await linkPlpSheet(spreadsheetUrl.trim());
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
      title="Link PLP Google Sheet"
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
                PLP ratings sync to your Google Sheet every 5 minutes
                with one tab per cycle (e.g. <strong>June-July 2026</strong>),
                or when you use menu <strong>TOMS PLP → Refresh now</strong>.
              </p>
              <ol className="small mb-3">
                {setup.steps.map((step) => (
                  <li key={step} className="mb-1">{step}</li>
                ))}
              </ol>
              {setup.note && <div className="alert alert-warning small">{setup.note}</div>}

              {[
                ['plp-export-url', 'Export API URL', setup.exportUrl, 'API URL'],
                ['plp-api-key', 'API key', setup.apiKey, 'API key'],
              ].map(([id, label, value, copyLabel]) => (
                <div className="mb-3" key={id}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label mb-0" htmlFor={id}>{label}</label>
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0"
                      onClick={() => handleCopy(value, copyLabel)}
                    >
                      Copy
                    </button>
                  </div>
                  <textarea
                    id={id}
                    className="form-control font-monospace small"
                    rows={id.includes('key') ? 2 : 2}
                    readOnly
                    value={value}
                  />
                </div>
              ))}

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label mb-0" htmlFor="plp-script">Apps Script</label>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0"
                    onClick={() => handleCopy(setup.script, 'Script')}
                  >
                    Copy script
                  </button>
                </div>
                <textarea
                  id="plp-script"
                  className="form-control font-monospace small"
                  rows={10}
                  readOnly
                  value={setup.script}
                />
              </div>

              <div className="mb-0">
                <label className="form-label" htmlFor="plp-sheet-url">Google Sheet URL</label>
                <input
                  id="plp-sheet-url"
                  type="url"
                  className="form-control"
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  required
                />
              </div>
            </>
          )}
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
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

export default PlpSheetSetupModal;
