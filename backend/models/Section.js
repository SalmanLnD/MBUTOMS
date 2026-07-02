import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
  },
  { timestamps: true }
);

sectionSchema.index({ department: 1, name: 1 }, { unique: true });

const Section = mongoose.model('Section', sectionSchema);
export default Section;
