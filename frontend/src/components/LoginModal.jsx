import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import ResetPasswordModal from './ResetPasswordModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoginModal } from '../context/LoginModalContext.jsx';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const LoginModal = () => {
  const {
    loginModalOpen,
    loginModalMessage,
    loginRedirectTo,
    closeLoginModal,
  } = useLoginModal();
  const { login, completePasswordReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleClose = () => {
    if (loading) return;
    setEmail('');
    setPassword('');
    closeLoginModal();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.requiresPasswordReset || data.mustResetPassword) {
        setShowResetModal(true);
        return;
      }
      closeLoginModal();
      setEmail('');
      setPassword('');
      if (loginRedirectTo && loginRedirectTo !== '/timetable') {
        navigate(loginRedirectTo, { replace: true });
      }
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetComplete = (data) => {
    completePasswordReset(data);
    setShowResetModal(false);
    closeLoginModal();
    setEmail('');
    setPassword('');
    if (loginRedirectTo && loginRedirectTo !== '/timetable') {
      navigate(loginRedirectTo, { replace: true });
    }
  };

  return (
    <>
      <Modal
        show={loginModalOpen}
        title="Sign in to TOMS"
        onClose={handleClose}
        size="toms-modal-lg"
        dismissible={!loading}
      >
        <form onSubmit={handleSubmit}>
          <div className="toms-modal-body">
            {loginModalMessage && (
              <div className="alert alert-info py-2 px-3 mb-3" role="status">
                {loginModalMessage}
              </div>
            )}

            <div className="row g-3">
              <div className="col-12">
                <label htmlFor="login-modal-email" className="form-label">Email</label>
                <input
                  type="email"
                  id="login-modal-email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trainer@example.com"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
              <div className="col-12">
                <label htmlFor="login-modal-password" className="form-label">Password</label>
                <input
                  type="password"
                  id="login-modal-password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password or initial OTP"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          </div>
          <div className="toms-modal-footer d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
      </Modal>

      {showResetModal && (
        <ResetPasswordModal show onComplete={handlePasswordResetComplete} />
      )}
    </>
  );
};

export default LoginModal;
