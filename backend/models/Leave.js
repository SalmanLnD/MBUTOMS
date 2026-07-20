import mongoose from 'mongoose';
import { LEAVE_SCOPES } from '../utils/leaveScope.js';

const leaveSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    scope: {
      type: String,
      enum: Object.values(LEAVE_SCOPES),
      default: LEAVE_SCOPES.FULL_DAY,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    affectedSchedules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' }],
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    replacementNeeded: { type: Boolean, default: true },
    replacements: [
      {
        schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
        // Campus trainer (optional when isExternal). Kept null for externals so hours are not attributed.
        replacementTrainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', default: null },
        isExternal: { type: Boolean, default: false },
        externalTrainerName: { type: String, trim: true, default: '' },
        assignedAt: { type: Date, default: Date.now },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

leaveSchema.index({ status: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ trainer: 1, status: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ affectedSchedules: 1 });
leaveSchema.index({ 'replacements.replacementTrainer': 1, status: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ 'replacements.schedule': 1, status: 1, startDate: 1, endDate: 1 });

const Leave = mongoose.model('Leave', leaveSchema);
export default Leave;
