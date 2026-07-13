import mongoose from 'mongoose';
import { TICKET_STATUSES, TICKET_TYPES } from '../utils/ticketConstants.js';

const ticketUpdateSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: TICKET_STATUSES,
      required: true,
    },
    comment: { type: String, trim: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, trim: true },
    type: {
      type: String,
      enum: TICKET_TYPES,
      required: true,
    },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: 'pending',
    },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    updates: [ticketUpdateSchema],
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ raisedBy: 1, createdAt: -1 });
ticketSchema.index({ trainer: 1, createdAt: -1 });

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
