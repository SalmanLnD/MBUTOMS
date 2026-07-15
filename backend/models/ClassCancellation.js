import mongoose from 'mongoose';

const classCancellationSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    scope: {
      type: String,
      enum: ['classes', 'school', 'all'],
      required: true,
    },
    schedules: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Schedule',
      required: true,
    }],
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null,
    },
    reason: { type: String, trim: true, maxlength: 300, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

classCancellationSchema.index({ date: 1, schedules: 1 });
classCancellationSchema.index({ createdAt: -1 });

const ClassCancellation = mongoose.model('ClassCancellation', classCancellationSchema);
export default ClassCancellation;
