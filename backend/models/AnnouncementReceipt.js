import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  announcement: { type: String, required: true },
  dismissedAt: { type: Date, required: true },
});
export default mongoose.model('AnnouncementReceipt', schema);
