import mongoose from 'mongoose';

const trainerDailyAttendanceSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
    },
    date: { type: Date, required: true },
    oifNumber: { type: String, trim: true, maxlength: 12, default: '' },
    mockPrepHours: { type: Number, min: 0, default: 0 },
    punchInAt: { type: Date },
    punchInSource: {
      type: String,
      enum: ['manual', 'whatsapp'],
      default: 'manual',
    },
    punchInImageUrl: { type: String, trim: true, default: '' },
    punchInRawPhone: { type: String, trim: true, default: '' },
    whatsappMessageIds: { type: [String], default: [] },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

trainerDailyAttendanceSchema.index({ trainer: 1, date: 1 }, { unique: true });
trainerDailyAttendanceSchema.index({ date: 1 });
trainerDailyAttendanceSchema.index({ punchInAt: -1 });
// Per-trainer punch log view filters by trainer and sorts by punch time.
trainerDailyAttendanceSchema.index({ trainer: 1, punchInAt: -1 });
trainerDailyAttendanceSchema.index({ whatsappMessageIds: 1 });

const TrainerDailyAttendance = mongoose.model('TrainerDailyAttendance', trainerDailyAttendanceSchema);
export default TrainerDailyAttendance;
