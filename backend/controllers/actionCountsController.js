import Ticket from '../models/Ticket.js';
import Leave from '../models/Leave.js';
import TopicTrackerEntry from '../models/TopicTrackerEntry.js';
import { countPendingReplacements } from './dashboardController.js';
import { countPendingLatePunches } from './latePunchController.js';
import { ALERT_SESSION_STATUSES } from '../utils/topicTrackerConstants.js';
import { FULL_ACCESS_ROLES, ROLES, isAuthorizedRole } from '../utils/roles.js';

const pendingCancellationFilter = {
  sessionStatus: { $in: ALERT_SESSION_STATUSES },
  $or: [
    { cancellationApprovalStatus: 'pending' },
    { cancellationApprovalStatus: 'none' },
    { cancellationApprovalStatus: { $exists: false } },
  ],
};

export const getActionCounts = async (req, res) => {
  const role = req.user.role;
  const canManage = isAuthorizedRole(role, FULL_ACCESS_ROLES);
  const counts = {
    tickets: 0,
    latePunches: 0,
    cancellations: 0,
    leaves: 0,
    replacements: 0,
  };

  if (!canManage && role !== ROLES.ADMIN) {
    return res.json(counts);
  }

  const jobs = [];
  if (role === ROLES.ADMIN) {
    jobs.push(Ticket.countDocuments({ status: 'pending' }).then((count) => {
      counts.tickets = count;
    }));
  }
  if (canManage) {
    jobs.push(countPendingLatePunches().then((count) => {
      counts.latePunches = count;
    }));
    jobs.push(TopicTrackerEntry.countDocuments(pendingCancellationFilter).then((count) => {
      counts.cancellations = count;
    }));
    jobs.push(Leave.countDocuments({ status: 'pending' }).then((count) => {
      counts.leaves = count;
    }));
    jobs.push(countPendingReplacements().then((count) => {
      counts.replacements = count;
    }));
  }

  await Promise.all(jobs);
  res.json(counts);
};
