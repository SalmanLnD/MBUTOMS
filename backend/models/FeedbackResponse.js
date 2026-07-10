import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true },
    label: { type: String, trim: true, default: '' },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const feedbackResponseSchema = new mongoose.Schema(
  {
    form: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackForm', required: true },
    monthKey: { type: String, required: true, trim: true },
    answers: [answerSchema],
    rating: { type: Number, min: 1, max: 5 },
    studentName: { type: String, trim: true, default: '' },
    rollNumber: { type: String, trim: true, default: '' },
    comments: { type: String, trim: true, default: '' },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
  },
  { timestamps: true }
);

feedbackResponseSchema.index({ form: 1, createdAt: -1 });
feedbackResponseSchema.index({ monthKey: 1, createdAt: -1 });
feedbackResponseSchema.index({ trainer: 1, monthKey: 1 });

const FeedbackResponse = mongoose.model('FeedbackResponse', feedbackResponseSchema);
export default FeedbackResponse;
