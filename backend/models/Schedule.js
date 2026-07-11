import mongoose from 'mongoose';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const scheduleSchema = new mongoose.Schema(
  {
    trainerCode: { type: String, required: true, trim: true, index: true },
    day: { type: String, required: true, enum: DAYS },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    department: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    subjectCode: { type: String, trim: true, default: '' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    slot: { type: String, enum: ['S1', 'S2', 'S3', 'S4', ''], default: '' },
    semester: { type: String, default: 'III', trim: true },
    replacementFor: {
      trainerCode: { type: String, trim: true, default: '' },
      trainerName: { type: String, trim: true, default: '' },
    },
    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', default: null },
    isLab: { type: Boolean, default: false },
    isProject: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'schedules' }
);

scheduleSchema.index({ trainerCode: 1, day: 1, startTime: 1 });
scheduleSchema.index({ day: 1, startTime: 1 });
scheduleSchema.index({ department: 1, section: 1, semester: 1 });
scheduleSchema.index({ semester: 1, trainerCode: 1 });

const Schedule = mongoose.model('Schedule', scheduleSchema);
export default Schedule;
