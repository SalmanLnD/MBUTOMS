import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
    },
    studentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

batchSchema.index({ section: 1, semester: 1, name: 1 }, { unique: true });

const Batch = mongoose.model('Batch', batchSchema);
export default Batch;
