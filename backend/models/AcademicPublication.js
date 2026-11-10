import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: { type: String, default: 'current' },
  currentTermId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicTerm', required: true },
  revision: { type: Number, default: 1 },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: { type: Date, default: Date.now },
  lease: { type: String, default: null },
  leaseExpiresAt: { type: Date, default: null },
}, { timestamps: true });
export default mongoose.model('AcademicPublication', schema);
