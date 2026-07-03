import mongoose from 'mongoose';
import { DEFAULT_SLOT_TIMINGS } from '../utils/timetableSlots.js';

const periodTimingSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true },
    schools: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }],
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
    },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    allDepartments: { type: Boolean, default: false },
    hours: { type: Number, default: 0, min: 0 },
    trainerEligible: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' }],
    slotTimings: {
      s1: {
        type: periodTimingSchema,
        default: () => ({ ...DEFAULT_SLOT_TIMINGS.s1 }),
      },
      s2: {
        type: periodTimingSchema,
        default: () => ({ ...DEFAULT_SLOT_TIMINGS.s2 }),
      },
      s3: {
        type: periodTimingSchema,
        default: () => ({ ...DEFAULT_SLOT_TIMINGS.s3 }),
      },
    },
    oifNumber: { type: String, required: true, trim: true },
    dealNumber: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
  },
  { timestamps: true }
);

const Subject = mongoose.model('Subject', subjectSchema);
export default Subject;
