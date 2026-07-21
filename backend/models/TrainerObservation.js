import mongoose from 'mongoose';

export const OBSERVATION_TYPES = ['demo', 'class'];

const trainerObservationSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
    },
    monthKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
    },
    type: {
      type: String,
      enum: OBSERVATION_TYPES,
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    comments: {
      type: String,
      trim: true,
      default: '',
    },
    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true, collection: 'trainer_observations' }
);

trainerObservationSchema.index(
  { trainer: 1, monthKey: 1, type: 1 },
  { unique: true }
);
trainerObservationSchema.index({ monthKey: 1, type: 1 });

const TrainerObservation = mongoose.model('TrainerObservation', trainerObservationSchema);
export default TrainerObservation;
