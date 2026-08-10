import mongoose from 'mongoose';

const studentMonthlyTestReportSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    subjectCode: { type: String, trim: true, default: '' },
    subjectName: { type: String, trim: true, default: '' },
    department: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    py: { type: Number, min: 2000, max: 2100 },
    semester: { type: String, required: true, trim: true },
    marksObtained: { type: Number, min: 0, default: null },
    maxMarks: { type: Number, min: 1, default: 10 },
    attendance: {
      type: String,
      enum: ['P', 'A'],
      default: 'P',
    },
    remarks: { type: String, trim: true, default: '' },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'student_monthly_test_reports' }
);

studentMonthlyTestReportSchema.index({ month: 1, student: 1, subject: 1 }, { unique: true });
studentMonthlyTestReportSchema.index({ month: 1, department: 1, section: 1, semester: 1, subject: 1 });
studentMonthlyTestReportSchema.index({ month: 1, subject: 1 });

const StudentMonthlyTestReport = mongoose.model(
  'StudentMonthlyTestReport',
  studentMonthlyTestReportSchema
);
export default StudentMonthlyTestReport;
