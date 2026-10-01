import mongoose from 'mongoose';

// Counters and leases only: no questions, answers, keys, or trainer data.
const schema = new mongoose.Schema({
  _id: String,
  count: { type: Number, default: 0 },
  events: [{ _id: false, at: Number, tokens: Number }],
  leaseId: String,
  leaseUntil: { type: Date, default: new Date(0) },
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('AiUsageBucket', schema);
