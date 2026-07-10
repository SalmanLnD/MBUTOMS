import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['short_text', 'paragraph', 'rating', 'multiple_choice', 'trainer_select'],
      required: true,
    },
    label: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    options: [{ type: String, trim: true }],
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const feedbackFormSchema = new mongoose.Schema(
  {
    monthKey: { type: String, required: true, unique: true, trim: true },
    title: { type: String, trim: true, default: 'Monthly Feedback' },
    description: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publicSlug: { type: String, unique: true, sparse: true, trim: true },
    fields: [fieldSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

feedbackFormSchema.index({ status: 1, monthKey: -1 });

const FeedbackForm = mongoose.model('FeedbackForm', feedbackFormSchema);
export default FeedbackForm;
