import mongoose from 'mongoose';

const academicYearSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const AcademicYear = mongoose.model('AcademicYear', academicYearSchema);
export default AcademicYear;
