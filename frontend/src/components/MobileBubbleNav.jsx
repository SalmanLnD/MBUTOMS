import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { navItems } from '../config/navItems.js';
import '../styles/mobile-nav.css';

const SWIPE_OPEN_THRESHOLD = 24;

/**
 * Mobile-only navigation: a floating translucent launcher bubble.
 * Tap or slide it to reveal the app pages as a cluster of glass bubbles;
 * tapping a bubble navigates and the cluster collapses.
 */
const MobileBubbleNav = () => {
  const { user, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const touchStart = useRef(null);
  const movedRef = useRef(false);

  const visibleItems = navItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  // Close the cluster whenever the route changes (e.g. back button).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    movedRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (!touchStart.current) return;
    const touch = e.touches[0];
    const dx = touchStart.current.x - touch.clientX;
    const dy = touchStart.current.y - touch.clientY;
    // Slide up or slide left opens the cluster.
    if (dx > SWIPE_OPEN_THRESHOLD || dy > SWIPE_OPEN_THRESHOLD) {
      movedRef.current = true;
      setOpen(true);
    }
  };

  const handleTouchEnd = () => {
    touchStart.current = null;
  };

  const handleLauncherClick = () => {
    // Ignore the synthetic click that follows a swipe-open.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setOpen((current) => !current);
  };

  const handleLogout = useCallback(() => {
    logout();
    navigate('/timetable');
  }, [logout, navigate]);

  const handleNavigate = useCallback(
    (path) => {
      setOpen(false);
      navigate(path);
    },
    [navigate]
  );

  if (!user) return null;

  return (
    <div className={`bubble-nav ${open ? 'bubble-nav--open' : ''}`}>
      {open && (
        <div
          className="bubble-nav-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div className="bubble-nav-cluster" role="menu" aria-label="App pages">
          <div className="bubble-nav-user">
            <span className="bubble-nav-user-avatar" aria-hidden="true">
              {user?.name?.charAt(0) || 'U'}
            </span>
            <span className="bubble-nav-user-name">{user?.name}</span>
            <button
              type="button"
              className="bubble-nav-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>

          <div className="bubble-nav-grid">
            {visibleItems.map(({ path, label, Icon }, index) => {
              const isActive = location.pathname.startsWith(path);
              return (
                <button
                  key={path}
                  type="button"
                  role="menuitem"
                  className={`bubble-nav-item ${isActive ? 'bubble-nav-item--active' : ''}`}
                  style={{ '--bubble-delay': `${index * 30}ms` }}
                  onClick={() => handleNavigate(path)}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="bubble-nav-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="bubble-nav-label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        className="bubble-nav-launcher"
        onClick={handleLauncherClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-expanded={open}
        aria-label={open ? 'Close navigation' : 'Open navigation'}
      >
        <span className="bubble-nav-launcher-dot" aria-hidden="true" />
        <span className="bubble-nav-launcher-dot" aria-hidden="true" />
        <span className="bubble-nav-launcher-dot" aria-hidden="true" />
      </button>
    </div>
  );
};

export default MobileBubbleNav;
