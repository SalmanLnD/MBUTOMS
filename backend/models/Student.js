import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    rollNumber: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    branch: { type: String, trim: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    sectionLabel: { type: String, trim: true, default: '' },
    py: { type: Number, min: 2000, max: 2100 },
    semesterLabel: { type: String, trim: true, default: '' },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    status: {
      type: String,
      enum: ['active', 'inactive', 'graduated'],
      default: 'active',
    },
  },
  { timestamps: true }
);

studentSchema.index({ status: 1, branch: 1, sectionLabel: 1 });
studentSchema.index({ status: 1, py: 1, semesterLabel: 1 });

const Student = mongoose.model('Student', studentSchema);
export default Student;
