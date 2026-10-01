import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ChevronLeftIcon } from './icons.jsx';
import { navItems } from '../config/navItems.js';
import { formatRole } from '../utils/helpers.js';
import '../styles/sidebar.css';
import { useAiAssistant } from '../context/AiAssistantContext.jsx';

const Sidebar = ({ collapsed = false, labelsVisible = true, onToggle }) => {
  const { user, hasRole } = useAuth();
  const assistant = useAiAssistant();

  const visibleItems = navItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  return (
    <aside
      className={[
        'sidebar',
        collapsed ? 'sidebar--collapsed' : '',
        labelsVisible ? 'sidebar--labels-visible' : 'sidebar--labels-hidden',
      ].filter(Boolean).join(' ')}
    >
      <div className="sidebar-brand">
        <span className="brand-icon" aria-hidden="true">T</span>
        <div className="sidebar-brand-text">
          <strong>TOMS</strong>
          <small className="d-block text-white-50">Training Operations</small>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {assistant?.enabled && <button type="button" className={`sidebar-link sidebar-assistant${assistant.open ? ' active' : ''}`}
          onClick={assistant.openAssistant} aria-label="Open TOMS Assistant" aria-haspopup="dialog" aria-expanded={assistant.open}>
          <span className="nav-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" /><path d="M8 8h8M8 12h5" /></svg></span><span className="sidebar-link-label">TOMS Assistant</span>
        </button>}
        {visibleItems.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            title={collapsed ? label : undefined}
            aria-label={label}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon size={18} />
            </span>
            <span className="sidebar-link-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {onToggle && (
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeftIcon size={18} />
            <span className="sidebar-toggle-label">
              {collapsed ? 'Expand' : 'Collapse'}
            </span>
          </button>
        )}

        <div className="user-info">
          <div className="user-avatar" title={user?.name || 'User'}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="sidebar-user-text">
            <div className="user-name">{user?.name}</div>
            <small className="text-white-50">{formatRole(user?.role)}</small>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
