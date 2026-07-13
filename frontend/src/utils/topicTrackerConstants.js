export const TOPIC_TRACKER_STATUSES = ['pending', 'closed'];

export const TOPIC_TRACKER_STATUS_LABELS = {
  pending: 'Pending',
  closed: 'Closed',
};

export const getTopicTrackerStatusBadgeClass = (status) => {
  if (status === 'closed') return 'bg-success';
  return 'bg-warning text-dark';
};

export const TOPIC_TRACKER_COLUMNS = [
  { key: 'date', label: 'Date', readOnly: true, width: 110 },
  { key: 'trainerName', label: 'Trainer Name', readOnly: true, width: 140 },
  { key: 'branchYearSection', label: 'Branch, Year & Section', readOnly: true, width: 180 },
  { key: 'roomNo', label: 'Room No', readOnly: true, width: 100 },
  { key: 'courseName', label: 'Course Name', readOnly: true, width: 140 },
  { key: 'topicModuleCovered', label: 'Topic / Module Covered', width: 200 },
  { key: 'sessionStartTime', label: 'Session Start Time', width: 120 },
  { key: 'sessionEndTime', label: 'Session End Time', width: 120 },
  { key: 'durationHrs', label: 'Duration (Hrs)', readOnly: true, width: 110 },
  { key: 'allottedStudents', label: 'Allotted students', width: 120 },
  { key: 'noPresent', label: 'No. Present', width: 110 },
  { key: 'attendancePercent', label: 'Attendance %', readOnly: true, width: 110 },
  { key: 'sessionStatus', label: 'Session Status', width: 130 },
  { key: 'keyObservationsFeedback', label: 'Key Observations / Feedback', width: 220 },
  { key: 'challengesFaced', label: 'Challenges Faced', width: 180 },
  { key: 'trackerStatus', label: 'Tracker Status', width: 120 },
];
