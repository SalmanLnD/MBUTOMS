import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true }
);

const School = mongoose.model('School', schoolSchema);
export default School;
