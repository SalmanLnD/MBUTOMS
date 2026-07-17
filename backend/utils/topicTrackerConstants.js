export const TOPIC_TRACKER_STATUSES = ['pending', 'closed'];

export const TOPIC_TRACKER_STATUS_LABELS = {
  pending: 'Pending',
  closed: 'Closed',
};

export const SESSION_STATUS_VALUES = ['completed', 'cancelled', 'postponed'];

export const SESSION_STATUS_LABELS = {
  completed: 'Completed',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
};

/** Session statuses that require admin approval before hours are deducted. */
export const ALERT_SESSION_STATUSES = ['cancelled', 'postponed'];

export const CANCELLATION_APPROVAL_STATUSES = ['none', 'pending', 'approved', 'rejected'];

export const CANCELLATION_APPROVAL_LABELS = {
  none: 'None',
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const TOPIC_TRACKER_COLUMNS = [
  'Date',
  'Trainer Name',
  'Branch, Year & Section',
  'Room No',
  'Course Name',
  'Topic / Module Covered',
  'Session Start Time',
  'Session End Time',
  'Duration (Hrs)',
  'Allotted students',
  'No. Present',
  'Attendance %',
  'Session Status',
  'Key Observations / Feedback',
  'Challenges Faced',
  'Tracker Status',
];
