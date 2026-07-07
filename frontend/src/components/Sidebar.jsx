import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  DashboardIcon,
  TrainerIcon,
  SubjectIcon,
  CalendarIcon,
  VenueIcon,
  VenueScheduleIcon,
  ClassesIcon,
  LeaveNavIcon,
  ReplacementIcon,
  ChevronLeftIcon,
} from './icons.jsx';
import '../styles/sidebar.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/trainers', label: 'Trainers', Icon: TrainerIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/subjects', label: 'Subjects', Icon: SubjectIcon, roles: ['admin', 'campus_manager'] },
  { path: '/timetable', label: 'Timetable', Icon: CalendarIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/venue-schedule', label: 'Venue Schedule', Icon: VenueScheduleIcon, roles: ['admin', 'campus_manager'] },
  { path: '/venues', label: 'Venues', Icon: VenueIcon, roles: ['admin', 'campus_manager'] },
  { path: '/classes-students', label: 'Classes & Students', Icon: ClassesIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/leaves', label: 'Leaves', Icon: LeaveNavIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/replacements', label: 'Replacements', Icon: ReplacementIcon, roles: ['admin', 'campus_manager'] },
];

const Sidebar = ({ collapsed = false, labelsVisible = true, onToggle }) => {
  const { user, hasRole } = useAuth();

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

        <div className="user-info">
          <div className="user-avatar" title={user?.name || 'User'}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="sidebar-user-text">
            <div className="user-name">{user?.name}</div>
            <small className="text-white-50">{user?.role?.replace('_', ' ')}</small>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
