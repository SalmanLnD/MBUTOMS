import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ChevronLeftIcon } from './icons.jsx';
import { navItems } from '../config/navItems.js';
import '../styles/sidebar.css';
import { useAiAssistant } from '../context/AiAssistantContext.jsx';
import SalluAvatar from './SalluAvatar.jsx';

const Sidebar = ({ collapsed = false, labelsVisible = true, onToggle }) => {
  const { hasRole } = useAuth();
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
          onClick={assistant.openAssistant} aria-label="Open Sallu" aria-haspopup="dialog" aria-expanded={assistant.open}>
          <span className="nav-icon" aria-hidden="true"><SalluAvatar size={24} /></span><span className="sidebar-link-label">Sallu</span>
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

      </div>
    </aside>
  );
};

export default Sidebar;
