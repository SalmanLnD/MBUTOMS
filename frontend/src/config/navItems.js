import {
  DashboardIcon,
  TrainerIcon,
  SubjectIcon,
  CalendarIcon,
  VenueScheduleIcon,
  VenueIcon,
  ClassesIcon,
  LeaveNavIcon,
  ChartIcon,
  ReplacementIcon,
} from '../components/icons.jsx';
import { MANAGEMENT_ROLES, ROLES } from '../utils/roles.js';

const ALL_STAFF = MANAGEMENT_ROLES;

export const navItems = [
  { path: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, roles: [...ALL_STAFF, ROLES.TRAINER] },
  { path: '/trainers', label: 'Trainers', Icon: TrainerIcon, roles: [...ALL_STAFF, ROLES.TRAINER] },
  { path: '/subjects', label: 'Subjects', Icon: SubjectIcon, roles: ALL_STAFF },
  { path: '/timetable', label: 'Timetable', Icon: CalendarIcon, roles: [...ALL_STAFF, ROLES.TRAINER] },
  { path: '/venue-schedule', label: 'Venue Schedule', Icon: VenueScheduleIcon, roles: ALL_STAFF },
  { path: '/venues', label: 'Venues', Icon: VenueIcon, roles: [...ALL_STAFF, ROLES.TRAINER] },
  { path: '/classes-students', label: 'Classes & Students', Icon: ClassesIcon, roles: [...ALL_STAFF, ROLES.TRAINER] },
  { path: '/leaves', label: 'Leaves', Icon: LeaveNavIcon, roles: [...ALL_STAFF, ROLES.TRAINER] },
  { path: '/performance', label: 'Performance', Icon: ChartIcon, roles: ALL_STAFF },
  { path: '/replacements', label: 'Replacements', Icon: ReplacementIcon, roles: ALL_STAFF },
];
