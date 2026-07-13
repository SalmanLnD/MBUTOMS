import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoginModal } from '../context/LoginModalContext.jsx';
import {
  registerSessionExpiredHandler,
  resetSessionExpiredState,
} from '../utils/sessionManager.js';
import { resetAllModalArtifacts } from '../utils/modalCleanup.js';

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
    logout();
    resetSessionExpiredState();
    setExpired(null);
    resetAllModalArtifacts();
    navigate('/timetable', { replace: true });
    openLoginModal({
      message: message || 'Your session has expired. Please sign in again to continue with your updated access.',
    });
  }, [expired, logout, navigate, openLoginModal]);

  if (!expired) return null;

  return (
    <Modal
      show
      dismissible={false}
      title="Session Expired"
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
      </div>
    </Modal>
  );
};

export default SessionExpiredModal;
