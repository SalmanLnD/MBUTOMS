import mongoose from 'mongoose';
import { termModel } from '../utils/academicTermContext.js';
import { academicTermsEnabled } from '../utils/academicTermContext.js';
import StudentIdentity from './StudentIdentity.js';

const studentSchema = new mongoose.Schema(
  {
    rollNumber: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    branch: { type: String, trim: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    sectionLabel: { type: String, trim: true, default: '' },
    py: { type: Number, min: 2000, max: 2100 },
    semesterLabel: { type: String, trim: true, default: '' },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    status: {
      type: String,
      enum: ['active', 'inactive', 'graduated'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// A student keeps one identity even when independently enrolled in many terms.
const reserveIdentity = async student => {
  if (!academicTermsEnabled() || !student.rollNumber) return;
  const identity = await StudentIdentity.findOneAndUpdate({ rollNumber: student.rollNumber },
    { $setOnInsert: { _id: student._id || new mongoose.Types.ObjectId(), name: student.name, email: student.email } },
    { upsert: true, new: true }).lean();
  student._id = identity._id;
};
studentSchema.pre('validate', async function () { if (this.isNew) await reserveIdentity(this); });
studentSchema.pre('insertMany', async function (_next, docs) { for (const doc of docs) await reserveIdentity(doc); });

studentSchema.index({ status: 1, branch: 1, sectionLabel: 1 });
studentSchema.index({ status: 1, py: 1, semesterLabel: 1 });
studentSchema.index({
  status: 1,
  branch: 1,
  sectionLabel: 1,
  semesterLabel: 1,
  rollNumber: 1,
});

const Student = termModel('Student', studentSchema);
export default Student;
