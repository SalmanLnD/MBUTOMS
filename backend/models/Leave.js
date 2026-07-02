import mongoose from 'mongoose';

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
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
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
        replacementTrainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', required: true },
        assignedAt: { type: Date, default: Date.now },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

const Leave = mongoose.model('Leave', leaveSchema);
export default Leave;
