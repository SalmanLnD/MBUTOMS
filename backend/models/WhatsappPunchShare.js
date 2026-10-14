import mongoose from 'mongoose';

const whatsappPunchShareSchema = new mongoose.Schema(
  {
    driveFileId: { type: String, required: true, trim: true },
    groupName: { type: String, required: true, trim: true },
    caption: { type: String, trim: true, default: '', maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0, min: 0 },
    claimedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    error: { type: String, trim: true, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

whatsappPunchShareSchema.index({ status: 1, createdAt: 1 });

const WhatsappPunchShare = mongoose.model('WhatsappPunchShare', whatsappPunchShareSchema);
export default WhatsappPunchShare;
