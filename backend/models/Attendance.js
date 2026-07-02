import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['trainer', 'student'],
      required: true,
    },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'leave', 'od', 'holiday'],
      required: true,
    },
    remarks: { type: String, trim: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSchema.index({ type: 1, date: 1, trainer: 1 });
attendanceSchema.index({ type: 1, date: 1, student: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
