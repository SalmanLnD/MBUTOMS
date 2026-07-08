import mongoose from 'mongoose';

const trainerSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    camuErpId: { type: String, trim: true, default: '' },
    camuPassword: { type: String, trim: true, default: '' },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    skills: [{ type: String, trim: true }],
    experience: { type: Number, default: 0 },
    joiningDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'unavailable'],
      default: 'active',
    },
    weeklyWorkloadHours: { type: Number, default: 0 },
    performanceScore: { type: Number, default: 0, min: 0, max: 100 },
    scheduleTrainerCodes: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

trainerSchema.index({ department: 1, name: 1 });
trainerSchema.index({ subjects: 1 });
trainerSchema.index({ scheduleTrainerCodes: 1 });

const Trainer = mongoose.model('Trainer', trainerSchema);
export default Trainer;
