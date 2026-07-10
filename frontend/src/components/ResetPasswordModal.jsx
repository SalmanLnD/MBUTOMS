import { useState } from 'react';
import Modal from './Modal.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';
import { resetPassword as resetPasswordApi } from '../services/authService.js';

const ResetPasswordModal = ({ show, onComplete }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const data = await resetPasswordApi({ newPassword, confirmPassword });
      showSuccess('Password updated successfully');
      onComplete(data);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      title="Set Your Password"
      size="toms-modal-md"
      onClose={() => {}}
    >
      <form onSubmit={handleSubmit}>
        <p className="text-muted mb-3">
          You signed in with the initial OTP. Please choose a new password to continue.
        </p>
        <div className="mb-3">
          <label htmlFor="newPassword" className="form-label">New password</label>
          <input
            id="newPassword"
            type="password"
            className="form-control"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="mb-4">
          <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            className="form-control"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={saving}>
          {saving ? 'Saving...' : 'Save password'}
        </button>
      </form>
    </Modal>
  );
};

export default ResetPasswordModal;
