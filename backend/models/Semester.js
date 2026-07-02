import mongoose from 'mongoose';

const semesterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: { type: Number, required: true },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

semesterSchema.index({ academicYear: 1, number: 1 }, { unique: true });

const Semester = mongoose.model('Semester', semesterSchema);
export default Semester;
