import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoginModal } from '../context/LoginModalContext.jsx';
import StyledSelect from './StyledSelect.jsx';
import NotificationBell from './NotificationBell.jsx';
import { CalendarIcon } from './icons.jsx';
import { formatRole, getErrorMessage } from '../utils/helpers.js';
import { ROLES } from '../utils/roles.js';
import { showError } from '../utils/toast.js';

const ACADEMIC_CALENDARS_URL = 'https://drive.google.com/drive/u/1/folders/1GvF_2ieWFGKaFfVvPTSaVG1bl87WQD3J';

const Topbar = ({ title }) => {
  const {
    user,
    logout,
    canImpersonateUsers,
    fetchImpersonationTargets,
    startImpersonation,
    stopImpersonation,
  } = useAuth();
  const { openLoginModal } = useLoginModal();
  const navigate = useNavigate();
  const location = useLocation();
  const showAcademicCalendars = location.pathname === '/timetable';
  const [targets, setTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [switchingView, setSwitchingView] = useState(false);

  const loadTargets = useCallback(async () => {
    if (!canImpersonateUsers()) return;
    setLoadingTargets(true);
    try {
      const list = await fetchImpersonationTargets();
      setTargets(list);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoadingTargets(false);
    }
  }, [canImpersonateUsers, fetchImpersonationTargets]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const handleLogout = () => {
    logout();
    navigate('/timetable');
  };

  const handleLogin = () => {
    openLoginModal();
  };

  const handleViewAsTrainer = async (userId) => {
    if (!userId || switchingView) return;
    setSwitchingView(true);
    try {
      await startImpersonation(userId);
      navigate('/dashboard');
      window.location.reload();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSwitchingView(false);
    }
  };

  const handleExitTrainerView = async () => {
    if (switchingView) return;
    setSwitchingView(true);
    try {
      await stopImpersonation();
      navigate('/dashboard');
      window.location.reload();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSwitchingView(false);
    }
  };

  const impersonationOptions = useMemo(
    () => [
      { value: '', label: loadingTargets ? 'Loading trainers...' : 'View as trainer...' },
      ...targets.map((target) => ({
        value: target._id,
        label: target.role === ROLES.SUBJECT_COORDINATOR
          ? `${target.name} (${target.employeeId}) · ${formatRole(ROLES.SUBJECT_COORDINATOR)}`
          : `${target.name} (${target.employeeId})`,
      })),
    ],
    [loadingTargets, targets]
  );

  return (
    <>
      {user?.impersonating && (
        <div className="impersonation-banner d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <span className="small">
            Viewing as <strong>{user.name}</strong> (trainer preview)
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={handleExitTrainerView}
            disabled={switchingView}
          >
            Exit trainer view
          </button>
        </div>
      )}

      <header className="topbar d-flex justify-content-between align-items-center mb-4 gap-3">
        <h1 className="h4 mb-0 fw-semibold">{title}</h1>
        {showAcademicCalendars && (
          <div className="topbar-spacer flex-grow-1 d-flex justify-content-center">
            <a
              href={ACADEMIC_CALENDARS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-primary btn-sm topbar-calendars-btn d-inline-flex align-items-center gap-2"
            >
              <CalendarIcon size={16} />
              Academic Calendars
            </a>
          </div>
        )}
        <div className="d-flex align-items-center gap-2 gap-md-3 flex-wrap justify-content-end">
          {user ? (
            <>
              {canImpersonateUsers() && (
                <div className="topbar-view-as" style={{ minWidth: '12rem', maxWidth: '16rem' }}>
                  <StyledSelect
                    value=""
                    onChange={(event) => handleViewAsTrainer(event.target.value)}
                    options={impersonationOptions}
                    placeholder="View as trainer..."
                    aria-label="View as trainer"
                    disabled={switchingView || loadingTargets}
                  />
                </div>
              )}

              <NotificationBell />

              <span className="topbar-user small">
                {user.name} · {formatRole(user.role)}
              </span>

              <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleLogin}>
              Login
            </button>
          )}
        </div>
      </header>
    </>
  );
};

export default Topbar;
