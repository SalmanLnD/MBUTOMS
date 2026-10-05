import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
  sessionVersion: { type: Number, required: true },
  vapidPublicKey: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('PushSubscription', schema);
