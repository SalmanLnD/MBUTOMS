import mongoose from 'mongoose';

const classGroupSchema = new mongoose.Schema(
  {
    department: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    py: { type: Number, required: true, min: 2000, max: 2100 },
    currentSemester: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true, collection: 'classes' }
);

classGroupSchema.index({ department: 1, section: 1, currentSemester: 1 }, { unique: true });
classGroupSchema.index({ status: 1, department: 1, section: 1, currentSemester: 1 });

classGroupSchema.virtual('label').get(function label() {
  return `${this.department} ${this.section}`;
});

classGroupSchema.set('toJSON', { virtuals: true });
classGroupSchema.set('toObject', { virtuals: true });

const ClassGroup = mongoose.model('ClassGroup', classGroupSchema);
export default ClassGroup;
