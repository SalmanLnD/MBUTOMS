import mongoose from 'mongoose';

const whatsappSyncJobSchema = new mongoose.Schema(
  {
    lookbackHours: { type: Number, default: 48, min: 1, max: 168 },
    force: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    claimedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

whatsappSyncJobSchema.index({ status: 1, createdAt: 1 });

const WhatsappSyncJob = mongoose.model('WhatsappSyncJob', whatsappSyncJobSchema);
export default WhatsappSyncJob;
