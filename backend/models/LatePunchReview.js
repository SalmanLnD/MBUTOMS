import mongoose from 'mongoose';

const latePunchReviewSchema = new mongoose.Schema(
  {
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainerDailyAttendance',
      required: true,
      unique: true,
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
    },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    monthKey: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
    decision: {
      type: String,
      enum: ['warning', 'misconduct', 'dismissed'],
      required: true,
    },
    compliance: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainerCompliance' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

latePunchReviewSchema.index({ trainer: 1, monthKey: 1, decision: 1 });

export default mongoose.model('LatePunchReview', latePunchReviewSchema);
