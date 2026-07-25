import {
  DashboardIcon,
  TrainerIcon,
  SubjectIcon,
  CalendarIcon,
  VenueIcon,
  ClassesIcon,
  LeaveNavIcon,
  ChartIcon,
  ReplacementIcon,
  TicketNavIcon,
  TopicTrackerIcon,
} from '../components/icons.jsx';
import { MANAGEMENT_ROLES, PERFORMANCE_ACCESS_ROLES, ROLES } from '../utils/roles.js';

const ALL_STAFF = MANAGEMENT_ROLES;
const TRAINER_NAV = [...ALL_STAFF, ROLES.TRAINER, ROLES.EVALUATOR];

export const navItems = [
  { path: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, roles: TRAINER_NAV },
  { path: '/trainers', label: 'Trainers', Icon: TrainerIcon, roles: TRAINER_NAV },
  { path: '/subjects', label: 'Subjects', Icon: SubjectIcon, roles: TRAINER_NAV },
  { path: '/timetable', label: 'Timetable', Icon: CalendarIcon, roles: TRAINER_NAV },
  { path: '/venues', label: 'Venues', Icon: VenueIcon, roles: TRAINER_NAV },
  { path: '/classes-students', label: 'Classes & Students', Icon: ClassesIcon, roles: TRAINER_NAV },
  { path: '/leaves', label: 'Leaves', Icon: LeaveNavIcon, roles: TRAINER_NAV },
  { path: '/tickets', label: 'Tickets', Icon: TicketNavIcon, roles: TRAINER_NAV },
  { path: '/topic-tracker', label: 'Topic Tracker', Icon: TopicTrackerIcon, roles: TRAINER_NAV },
  { path: '/performance', label: 'Performance', Icon: ChartIcon, roles: PERFORMANCE_ACCESS_ROLES },
  { path: '/replacements', label: 'Replacements', Icon: ReplacementIcon, roles: ALL_STAFF },
];
