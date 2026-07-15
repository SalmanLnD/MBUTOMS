import mongoose from 'mongoose';
import { normalizePhone } from '../utils/phone.js';

const trainerSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    // Derived 10-digit lookup key so WhatsApp punch-ins resolve with an
    // indexed query instead of scanning every trainer.
    phoneKey: { type: String, default: '' },
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
    showInRoster: { type: Boolean, default: true },
  },
  { timestamps: true }
);

trainerSchema.index({ department: 1, name: 1 });
trainerSchema.index({ subjects: 1 });
trainerSchema.index({ scheduleTrainerCodes: 1 });
trainerSchema.index({ phoneKey: 1 });

trainerSchema.pre('save', function deriveTrainerPhoneKey(next) {
  if (this.isModified('phone') || this.isNew) {
    this.phoneKey = normalizePhone(this.phone);
  }
  next();
});

trainerSchema.pre('findOneAndUpdate', function deriveTrainerPhoneKeyOnUpdate(next) {
  const update = this.getUpdate() || {};
  const phone = update.phone ?? update.$set?.phone;
  if (phone !== undefined) {
    this.set({ phoneKey: normalizePhone(phone) });
  }
  next();
});

const Trainer = mongoose.model('Trainer', trainerSchema);
export default Trainer;
