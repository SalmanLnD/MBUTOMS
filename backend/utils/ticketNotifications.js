import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { ROLES } from './roles.js';
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS } from './ticketConstants.js';

const getAdminRecipients = async () =>
  User.find({ role: ROLES.ADMIN, isActive: true }).select('_id').lean();

export const notifyAdminsOfNewTicket = async (ticket, actor) => {
  const recipients = await getAdminRecipients();
  if (!recipients.length) return;

  const typeLabel = TICKET_TYPE_LABELS[ticket.type] || 'support ticket';
  const description = ticket.description?.trim();
  const detail = description
    ? `: ${description.length > 100 ? `${description.slice(0, 100)}...` : description}`
    : '';
  const message = `${actor.name} raised ${ticket.ticketId} (${typeLabel})${detail}`;

  await Notification.insertMany(
    recipients.map((recipient) => ({
      recipient: recipient._id,
      actor: actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'raised',
      resource: 'support ticket',
      message,
      entityPath: `/tickets?ticket=${ticket._id}`,
    }))
  );
};

export const notifyRaisedByOfTicketStatusUpdate = async (ticket, actor, status, comment) => {
  const raisedById = ticket.raisedBy?.toString();
  if (!raisedById || raisedById === actor._id.toString()) return;

  const statusLabel = TICKET_STATUS_LABELS[status] || status;
  const commentSuffix = comment ? `: ${comment}` : '';
  const message = `Your ticket ${ticket.ticketId} was marked as ${statusLabel}${commentSuffix}`;

  await Notification.create({
    recipient: raisedById,
    actor: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'updated',
    resource: 'support ticket',
    message,
    entityPath: `/tickets?ticket=${ticket._id}`,
  });
};
