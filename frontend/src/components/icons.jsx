const IconBase = ({ children, size = 20, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const DashboardIcon = (props) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </IconBase>
);

export const TrainerIcon = (props) => (
  <IconBase {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </IconBase>
);

export const SubjectIcon = (props) => (
  <IconBase {...props}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </IconBase>
);

export const CalendarIcon = (props) => (
  <IconBase {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </IconBase>
);

export const VenueIcon = (props) => (
  <IconBase {...props}>
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9v.01" />
    <path d="M9 12v.01" />
    <path d="M9 15v.01" />
    <path d="M9 18v.01" />
  </IconBase>
);

export const VenueScheduleIcon = (props) => (
  <IconBase {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
  </IconBase>
);

export const StudentIcon = (props) => (
  <IconBase {...props}>
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
  </IconBase>
);

export const ClassesIcon = (props) => (
  <IconBase {...props}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </IconBase>
);

export const LeaveIcon = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </IconBase>
);

export const ReplacementIcon = (props) => (
  <IconBase {...props}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </IconBase>
);

export const EditIcon = (props) => (
  <IconBase {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </IconBase>
);

export const EyeIcon = (props) => (
  <IconBase {...props}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

export const AttendanceIcon = (props) => (
  <IconBase {...props}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </IconBase>
);

export const LeaveNavIcon = (props) => (
  <IconBase {...props}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </IconBase>
);

export const TicketNavIcon = (props) => (
  <IconBase {...props}>
    <path d="M15 5V3" />
    <path d="M9 5V3" />
    <path d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <line x1="9" y1="11" x2="15" y2="11" />
    <line x1="9" y1="15" x2="13" y2="15" />
  </IconBase>
);

export const SheetIcon = (props) => (
  <IconBase {...props}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="10" y2="21" />
  </IconBase>
);

export const TopicTrackerIcon = (props) => (
  <IconBase {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <path d="M12 12h5" />
    <path d="M12 17h3" />
  </IconBase>
);

export const ExternalLinkIcon = (props) => (
  <IconBase {...props}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </IconBase>
);

export const ChevronLeftIcon = (props) => (
  <IconBase {...props}>
    <path d="m15 18-6-6 6-6" />
  </IconBase>
);

export const ChevronRightIcon = (props) => (
  <IconBase {...props}>
    <path d="m9 18 6-6-6-6" />
  </IconBase>
);

export const PlusIcon = (props) => (
  <IconBase {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </IconBase>
);

export const TrashIcon = (props) => (
  <IconBase {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </IconBase>
);

export const KeyIcon = (props) => (
  <IconBase {...props}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.5 13.5 7-7" />
    <path d="m15.5 6.5 2 2" />
    <path d="m18 4 2 2" />
  </IconBase>
);

export const ChartIcon = (props) => (
  <IconBase {...props}>
    <path d="M3 3v18h18" />
    <path d="M7 16V9" />
    <path d="M12 16V5" />
    <path d="M17 16v-7" />
  </IconBase>
);

export const CopyIcon = (props) => (
  <IconBase {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </IconBase>
);

export const BellIcon = (props) => (
  <IconBase {...props}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </IconBase>
);

export const CheckReadIcon = (props) => (
  <IconBase {...props}>
    <path d="M20 6 9 17l-5-5" />
  </IconBase>
);
