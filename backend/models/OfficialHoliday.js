import mongoose from 'mongoose';

const officialHolidaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true },
    name: { type: String, trim: true, maxlength: 80, default: 'Official leave' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const OfficialHoliday = mongoose.model('OfficialHoliday', officialHolidaySchema);
export default OfficialHoliday;
