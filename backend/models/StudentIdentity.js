import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  rollNumber: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  email: String,
}, { timestamps: true, collection: 'student_identities' });
export default mongoose.model('StudentIdentity', schema);
