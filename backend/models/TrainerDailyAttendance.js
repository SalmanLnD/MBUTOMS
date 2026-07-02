import mongoose from 'mongoose';

const trainerDailyAttendanceSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
    },
    date: { type: Date, required: true },
    oifNumber: { type: String, trim: true, default: '' },
    mockPrepHours: { type: Number, min: 0, default: 0 },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

trainerDailyAttendanceSchema.index({ trainer: 1, date: 1 }, { unique: true });

const TrainerDailyAttendance = mongoose.model('TrainerDailyAttendance', trainerDailyAttendanceSchema);
export default TrainerDailyAttendance;
