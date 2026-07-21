import mongoose from 'mongoose';
import { TRAINER_ATTENDANCE_TYPES } from '../utils/trainerAttendanceTypes.js';
import { FOOD_ALLOWANCE_TYPES } from '../utils/foodAllowanceTypes.js';

const trainerDailyAttendanceSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
    },
    date: { type: Date, required: true },
    attendanceType: {
      type: String,
      enum: Object.values(TRAINER_ATTENDANCE_TYPES),
      default: TRAINER_ATTENDANCE_TYPES.OIF,
    },
    oifNumber: { type: String, trim: true, maxlength: 12, default: '' },
    mockPrepHours: { type: Number, min: 0, default: 0 },
    // Used when OIF is not a campus subject (auto timetable hours do not apply).
    classHandlingHours: { type: Number, min: 0, default: undefined },
    foodAllowance: {
      type: String,
      enum: ['', ...Object.values(FOOD_ALLOWANCE_TYPES)],
      default: '',
    },
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
