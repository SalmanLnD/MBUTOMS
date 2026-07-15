import { useCallback, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoginModal } from '../context/LoginModalContext.jsx';
import {
  registerSessionExpiredHandler,
  resetSessionExpiredState,
} from '../utils/sessionManager.js';

const SessionExpiredModal = () => {
  const [expired, setExpired] = useState(null);
  const { logout } = useAuth();
  const { openLoginModal } = useLoginModal();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    return registerSessionExpiredHandler((payload) => {
      setExpired(payload);
    });
  }, []);

  const handleSignInAgain = useCallback(() => {
    const message = expired?.message;
    // Unmount this modal via React first; logout only resets body scroll (not portals).
    setExpired(null);
    resetSessionExpiredState();
    logout();
    navigate('/timetable', { replace: true });
    openLoginModal({
      message: message || 'Your session has expired. Please sign in again to continue with your updated access.',
    });
  }, [expired, logout, navigate, openLoginModal]);

  if (!expired) return null;
  const isVersionUpdate = expired.code === 'APP_VERSION_UPDATED';

  return (
    <Modal
      show
      dismissible={false}
      title={isVersionUpdate ? 'Session Expired — Application Updated' : 'Session Expired'}
      onClose={handleSignInAgain}
      footer={(
        <button type="button" className="btn btn-primary" onClick={handleSignInAgain}>
          Sign in again
        </button>
      )}
    >
      <div className="toms-modal-body">
        <p className="mb-0">
          {expired.message || 'Your session has expired. Please sign in again to continue with your updated access.'}
        </p>
        {isVersionUpdate && (
          <p className="text-muted small mt-2 mb-0">
            Signing in again refreshes your account with the latest interface and features.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default SessionExpiredModal;
