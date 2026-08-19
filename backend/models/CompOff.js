import mongoose from 'mongoose';

export const COMP_OFF_STATUSES = {
  PENDING: 'pending',
  CLOSED: 'closed',
};

const compOffSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      default: null,
    },
    employeeId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    base: { type: String, required: true, trim: true },
    dateWorkedOn: { type: Date, required: true },
    uniqueId: { type: String, required: true, trim: true },
    count: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(COMP_OFF_STATUSES),
      default: COMP_OFF_STATUSES.PENDING,
    },
    availedOn: { type: Date, default: null },
  },
  { timestamps: true }
);

compOffSchema.index({ employeeId: 1, status: 1, dateWorkedOn: 1 });
compOffSchema.index({ trainer: 1, status: 1, dateWorkedOn: 1 });
compOffSchema.index({ trainer: 1, availedOn: 1, status: 1 });
compOffSchema.index({ uniqueId: 1 });

const CompOff = mongoose.model('CompOff', compOffSchema);
export default CompOff;
