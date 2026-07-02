import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    building: { type: String, required: true, trim: true },
    floor: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    type: {
      type: String,
      enum: ['classroom', 'lab', 'auditorium', 'seminar_hall', 'other'],
      default: 'classroom',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

venueSchema.index({ name: 1, building: 1 }, { unique: true });

const Venue = mongoose.model('Venue', venueSchema);
export default Venue;
