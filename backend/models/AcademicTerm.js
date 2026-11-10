import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  academicYear: { type: String, required: true, match: /^\d{4}-\d{4}$/ },
  parity: { type: String, enum: ['odd', 'even'], required: true },
  key: { type: String, required: true, unique: true },
  lifecycle: { type: String, enum: ['draft', 'current', 'archived'], default: 'draft' },
  startDate: Date,
  endDate: Date,
  calendarUrl: { type: String, default: '' },
  programDurations: { type: Map, of: Number, default: {} },
  predecessor: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicTerm' },
  storageKey: { type: String, default: 'shared' },
  routingRevision: { type: Number, default: 0 },
  preparation: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });
schema.index({ academicYear: 1, parity: 1 }, { unique: true });
export default mongoose.model('AcademicTerm', schema);
