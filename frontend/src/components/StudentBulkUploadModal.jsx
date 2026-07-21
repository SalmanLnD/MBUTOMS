import { useState } from 'react';
import Modal from './Modal.jsx';
import { DownloadIcon, UploadIcon } from './icons.jsx';
import {
  bulkUploadStudents,
  downloadStudentBulkTemplate,
} from '../services/studentService.js';
import { getErrorMessage } from '../utils/helpers.js';

const StudentBulkUploadModal = ({ show, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const resetState = () => {
    setFile(null);
    setUpdateExisting(false);
    setLoading(false);
    setDownloading(false);
    setError('');
    setResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setError('');
    try {
      const blob = await downloadStudentBulkTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-bulk-upload-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Choose an Excel (.xlsx) or CSV (.csv) file to upload');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await bulkUploadStudents(file, { updateExisting });
      setResult(data);
      onImported?.(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <Modal
      show={show}
      title="Bulk Upload Students"
      onClose={handleClose}
      size="toms-modal-lg"
      scrollable
    >
      <form onSubmit={handleSubmit}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}

          <p className="text-muted small mb-3">
            Upload an Excel or CSV file with columns:
            {' '}
            <strong>Roll Number</strong>
            ,
            {' '}
            <strong>Name</strong>
            ,
            {' '}
            <strong>Email</strong>
            ,
            {' '}
            <strong>Branch</strong>
            ,
            {' '}
            <strong>Section</strong>
            ,
            {' '}
            <strong>Passed Out Year</strong>
            ,
            {' '}
            <strong>Semester</strong>
            ,
            {' '}
            <strong>Status</strong>
            .
            Roll Number and Name are required. Semester accepts I–VIII or 1–8. Status defaults to active.
          </p>

          <div className="d-flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
              onClick={handleDownloadTemplate}
              disabled={downloading || loading}
            >
              <DownloadIcon size={16} />
              {downloading ? 'Downloading...' : 'Download template'}
            </button>
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="student-bulk-file">
              Student file
            </label>
            <input
              id="student-bulk-file"
              type="file"
              className="form-control"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={loading}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setResult(null);
                setError('');
              }}
            />
            {file && (
              <div className="form-text">
                Selected:
                {' '}
                {file.name}
              </div>
            )}
          </div>

          <div className="form-check mb-3">
            <input
              id="student-bulk-update-existing"
              type="checkbox"
              className="form-check-input"
              checked={updateExisting}
              disabled={loading}
              onChange={(event) => setUpdateExisting(event.target.checked)}
            />
            <label className="form-check-label" htmlFor="student-bulk-update-existing">
              Update existing students when roll number already exists
            </label>
          </div>

          {result && (
            <div className="alert alert-secondary mb-0">
              <div className="fw-semibold mb-1">{result.message}</div>
              <div className="small">
                Created:
                {' '}
                {result.created || 0}
                {' '}
                | Updated:
                {' '}
                {result.updated || 0}
                {' '}
                | Skipped:
                {' '}
                {result.skipped || 0}
                {' '}
                | Failed:
                {' '}
                {result.failed || 0}
              </div>
              {Array.isArray(result.errors) && result.errors.length > 0 && (
                <ul className="small mb-0 mt-2 ps-3">
                  {result.errors.slice(0, 10).map((entry, index) => (
                    <li key={`${entry.row || 'x'}-${index}`}>
                      {entry.row ? `Row ${entry.row}: ` : ''}
                      {(entry.errors || []).join('; ')}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>
                      …
                      {result.errors.length - 10}
                      {' '}
                      more
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="toms-modal-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={handleClose} disabled={loading}>
            Close
          </button>
          <button type="submit" className="btn btn-primary d-inline-flex align-items-center gap-2" disabled={loading || !file}>
            <UploadIcon size={16} />
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default StudentBulkUploadModal;
