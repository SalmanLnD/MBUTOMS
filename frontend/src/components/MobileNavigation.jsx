import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { navItems } from '../config/navItems.js';
import { formatRole } from '../utils/helpers.js';
import Modal from './Modal.jsx';
import '../styles/mobile-nav.css';
import { useAiAssistant } from '../context/AiAssistantContext.jsx';
import SalluAvatar from './SalluAvatar.jsx';

const MobileNavigation = () => {
  const { user, hasRole } = useAuth();
  const assistant = useAiAssistant();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 767.98px)');
  const [open, setOpen] = useState(false);
  const visibleItems = navItems.filter((item) => item.roles.some((role) => hasRole(role)) || item.allowedUserIds?.includes(String(user?._id || user?.id || '')));
  const shortcuts = ['/dashboard', '/timetable', '/leaves']
    .map((path) => visibleItems.find((item) => item.path === path)).filter(Boolean);
  const moreActive = !shortcuts.some(({ path }) => location.pathname.startsWith(path));

  useEffect(() => { setOpen(false); }, [location.pathname, isMobile]);
  if (!user || !isMobile) return null;

  return (
    <>
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {shortcuts.map(({ path, label, Icon }) => (
          <NavLink key={path} to={path} className={({ isActive }) => `mobile-navigation__link${isActive ? ' is-active' : ''}`}>
            <Icon size={21} /><span>{label}</span>
          </NavLink>
        ))}
        <button type="button" className={`mobile-navigation__link${moreActive || open ? ' is-active' : ''}`}
          onClick={() => setOpen(true)} aria-label="Open all pages" aria-haspopup="dialog" aria-expanded={open}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>All pages</span>
        </button>
      </nav>
      <Modal show={open} onClose={() => setOpen(false)} title="All pages" className="mobile-pages-dialog" scrollable>
        <div className="toms-modal-body mobile-pages-body">
          <div className="mobile-pages-user"><strong>{user.name}</strong><span>{formatRole(user.isDemo && !user.impersonating ? 'demo' : user.role)}</span></div>
          <nav className="mobile-pages-list" aria-label="All app pages">
            {assistant?.enabled && <button type="button" className="mobile-pages-link" aria-label="Open Sallu"
              onClick={(event) => { setOpen(false); assistant.openAssistant(event); }}>
              <SalluAvatar size={24} /><span className="mobile-pages-label">Sallu</span><span className="mobile-pages-chevron" aria-hidden="true">›</span>
            </button>}
            {visibleItems.map(({ path, label, Icon }) => (
              <NavLink key={path} to={path} onClick={() => setOpen(false)} className={({ isActive }) => `mobile-pages-link${isActive ? ' is-active' : ''}`}>
                <Icon size={20} /><span className="mobile-pages-label">{label}</span><span className="mobile-pages-chevron" aria-hidden="true">›</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </Modal>
    </>
  );
};
export default MobileNavigation;
