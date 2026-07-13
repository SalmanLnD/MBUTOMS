import Ticket from '../models/Ticket.js';
import Trainer from '../models/Trainer.js';
import User from '../models/User.js';
import { ROLES } from '../utils/roles.js';
import { TICKET_STATUSES } from '../utils/ticketConstants.js';
import { notifyAdminsOfNewTicket, notifyRaisedByOfTicketStatusUpdate } from '../utils/ticketNotifications.js';

const populateOptions = [
  { path: 'raisedBy', select: 'name email role' },
  { path: 'trainer', select: 'name employeeId' },
  { path: 'updates.updatedBy', select: 'name role' },
];

export const generateTicketId = async () => {
  const latest = await Ticket.findOne().sort({ ticketId: -1 }).select('ticketId').lean();
  if (!latest?.ticketId) return 'TKT-000001';

  const match = latest.ticketId.match(/TKT-(\d+)/);
  const next = match ? parseInt(match[1], 10) + 1 : 1;
  return `TKT-${String(next).padStart(6, '0')}`;
};

const canViewTicket = (ticket, user) => {
  if (user.role === ROLES.ADMIN) return true;
  return ticket.raisedBy?.toString() === user._id.toString()
    || ticket.raisedBy?._id?.toString() === user._id.toString();
};

export const getTickets = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  if (req.user.role !== ROLES.ADMIN) {
    filter.raisedBy = req.user._id;
  }

  const [tickets, total] = await Promise.all([
    Ticket.find(filter).populate(populateOptions).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Ticket.countDocuments(filter),
  ]);

  res.json({ tickets, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const getTicketById = async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).populate(populateOptions);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  if (!canViewTicket(ticket, req.user)) {
    return res.status(403).json({ message: 'Not authorized to view this ticket' });
  }

  res.json(ticket);
};

export const createTicket = async (req, res) => {
  const { type, description, raisedByTrainer } = req.body;

  let raisedBy = req.user._id;
  let trainer;

  if (req.user.role === ROLES.ADMIN) {
    if (!raisedByTrainer) {
      return res.status(400).json({ message: 'Raised by is required' });
    }

    if (raisedByTrainer === 'self') {
      trainer = undefined;
    } else {
      const trainerRecord = await Trainer.findById(raisedByTrainer);
      if (!trainerRecord) {
        return res.status(404).json({ message: 'Selected trainer not found' });
      }

      const trainerUser = await User.findOne({
        trainer: trainerRecord._id,
        role: ROLES.TRAINER,
        isActive: true,
      });

      if (!trainerUser) {
        return res.status(400).json({
          message: 'Selected trainer does not have an active user account',
        });
      }

      raisedBy = trainerUser._id;
      trainer = trainerRecord._id;
    }
  } else if (req.user.role === ROLES.TRAINER) {
    trainer = req.user.trainer;
  }

  const ticket = await Ticket.create({
    ticketId: await generateTicketId(),
    type,
    description: description.trim(),
    raisedBy,
    trainer,
  });

  if (req.user.role === ROLES.TRAINER) {
    await notifyAdminsOfNewTicket(ticket, req.user);
  }

  const populated = await Ticket.findById(ticket._id).populate(populateOptions);
  res.status(201).json(populated);
};

export const updateTicketStatus = async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  const { status, comment } = req.body;
  if (!TICKET_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid ticket status' });
  }

  const trimmedComment = comment?.trim() || '';
  if (['solving', 'closed'].includes(status) && !trimmedComment) {
    return res.status(400).json({
      message: 'A resolve comment is required when marking a ticket as solving or closed',
    });
  }

  ticket.status = status;
  ticket.updates.push({
    status,
    comment: trimmedComment,
    updatedBy: req.user._id,
  });
  await ticket.save();

  await notifyRaisedByOfTicketStatusUpdate(ticket, req.user, status, trimmedComment);

  const populated = await Ticket.findById(ticket._id).populate(populateOptions);
  res.json(populated);
};
