import mongoose from 'mongoose';

const trainerPlpOverrideSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
      index: true,
    },
    cycleKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
      index: true,
    },
    finalRating: {
      type: Number,
      required: true,
      min: 3.5,
      max: 4.5,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

trainerPlpOverrideSchema.index({ trainer: 1, cycleKey: 1 }, { unique: true });

export default mongoose.model('TrainerPlpOverride', trainerPlpOverrideSchema);
