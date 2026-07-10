import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { ROLES } from './roles.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const MANAGER_EDIT_ROLES = new Set([
  ROLES.MANAGER,
  ROLES.CAMPUS_MANAGER,
  ROLES.SUBJECT_COORDINATOR,
]);

const ACTION_LABELS = {
  POST: 'created',
  PUT: 'updated',
  PATCH: 'updated',
  DELETE: 'deleted',
};

const RESOURCE_LABELS = {
  trainers: 'trainer record',
  venues: 'venue',
  subjects: 'subject',
  schedules: 'schedule',
  leaves: 'leave request',
  attendance: 'attendance',
  replacements: 'replacement',
  classes: 'class',
  students: 'student',
  feedback: 'feedback form',
  sheets: 'timetable sheet link',
};

const SKIP_PATH_PREFIXES = ['/api/auth', '/api/notifications', '/api/webhooks', '/api/health'];

const extractResourceKey = (path = '') => {
  const segments = path.split('/').filter(Boolean);
  if (segments[0] !== 'api' || !segments[1]) return 'record';
  return segments[1];
};

const extractDetail = (body) => {
  if (!body || typeof body !== 'object') return '';
  const candidates = [
    body.name,
    body.title,
    body.employeeId,
    body.email,
    body.code,
    body.label,
    body.trainer?.name,
    body.subject?.name,
  ];
  const detail = candidates.find((value) => typeof value === 'string' && value.trim());
  return detail?.trim() || '';
};

const shouldNotifyForRequest = (req) => {
  if (!req.user || req.impersonator) return false;
  if (!MUTATING_METHODS.has(req.method)) return false;
  if (!MANAGER_EDIT_ROLES.has(req.user.role)) return false;
  if (SKIP_PATH_PREFIXES.some((prefix) => req.originalUrl.startsWith(prefix))) return false;
  return true;
};

const getAdminRecipients = async () =>
  User.find({ role: ROLES.ADMIN, isActive: true }).select('_id').lean();

export const createManagerEditNotifications = async (req, responseBody) => {
  if (!shouldNotifyForRequest(req)) return;

  const recipients = await getAdminRecipients();
  if (!recipients.length) return;

  const resourceKey = extractResourceKey(req.originalUrl || req.url || '');
  const resource = RESOURCE_LABELS[resourceKey] || 'record';
  const action = ACTION_LABELS[req.method] || 'changed';
  const detail = extractDetail(responseBody);
  const detailSuffix = detail ? `: ${detail}` : '';
  const message = `${req.user.name} ${action} a ${resource}${detailSuffix}`;

  await Notification.insertMany(
    recipients.map((recipient) => ({
      recipient: recipient._id,
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action,
      resource,
      message,
      entityPath: req.originalUrl.split('?')[0],
    }))
  );
};

export const attachManagerEditNotifier = (req, res) => {
  if (!shouldNotifyForRequest(req) || res.locals.managerEditNotifierAttached) return;
  res.locals.managerEditNotifierAttached = true;

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode || 200;
    if (status >= 200 && status < 300) {
      void createManagerEditNotifications(req, body).catch(() => {});
    }
    return originalJson(body);
  };
};
