import mongoose from 'mongoose';

const trainerComplianceSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
      index: true,
    },
    date: { type: Date, required: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    monthKey: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
    remark: { type: String, required: true, trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

trainerComplianceSchema.index({ trainer: 1, monthKey: 1 });
trainerComplianceSchema.index({ monthKey: 1, createdAt: -1 });

export default mongoose.model('TrainerCompliance', trainerComplianceSchema);
