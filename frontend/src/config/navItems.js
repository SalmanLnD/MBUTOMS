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
  ChartIcon,
} from '../components/icons.jsx';

/** Shared app navigation used by the desktop sidebar and mobile bubble nav. */
export const navItems = [
  { path: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/trainers', label: 'Trainers', Icon: TrainerIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/subjects', label: 'Subjects', Icon: SubjectIcon, roles: ['admin', 'campus_manager'] },
  { path: '/timetable', label: 'Timetable', Icon: CalendarIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/venue-schedule', label: 'Venue Schedule', Icon: VenueScheduleIcon, roles: ['admin', 'campus_manager'] },
  { path: '/venues', label: 'Venues', Icon: VenueIcon, roles: ['admin', 'campus_manager'] },
  { path: '/classes-students', label: 'Classes & Students', Icon: ClassesIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/leaves', label: 'Leaves', Icon: LeaveNavIcon, roles: ['admin', 'campus_manager', 'trainer'] },
  { path: '/performance', label: 'Performance', Icon: ChartIcon, roles: ['admin', 'campus_manager'] },
  { path: '/replacements', label: 'Replacements', Icon: ReplacementIcon, roles: ['admin', 'campus_manager'] },
];
