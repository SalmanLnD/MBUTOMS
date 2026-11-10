import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  termId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sourceTermId: mongoose.Schema.Types.ObjectId,
  kind: { type: String, enum: ['prepare', 'publish', 'migration'], required: true },
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  manifest: mongoose.Schema.Types.Mixed,
  error: String,
}, { timestamps: true });
export default mongoose.model('AcademicTermJob', schema);
