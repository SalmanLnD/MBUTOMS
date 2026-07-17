import mongoose from 'mongoose';
import {
  TOPIC_TRACKER_STATUSES,
  CANCELLATION_APPROVAL_STATUSES,
} from '../utils/topicTrackerConstants.js';

const topicTrackerEntrySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    day: { type: String, trim: true, default: '' },
    slot: { type: String, trim: true, default: '' },
    trainerName: { type: String, trim: true, default: '' },
    branchYearSection: { type: String, trim: true, default: '' },
    roomNo: { type: String, trim: true, default: '' },
    courseName: { type: String, trim: true, default: '' },
    topicModuleCovered: { type: String, trim: true, default: '' },
    topicModulesCovered: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    sessionStartTime: { type: String, trim: true, default: '' },
    sessionEndTime: { type: String, trim: true, default: '' },
    durationHrs: { type: Number, default: 0 },
    allottedStudents: { type: Number, default: 0 },
    noPresent: { type: Number, default: 0 },
    attendancePercent: { type: Number, default: null },
    sessionStatus: { type: String, trim: true, default: '' },
    keyObservationsFeedback: { type: String, trim: true, default: '' },
    challengesFaced: { type: String, trim: true, default: '' },
    trackerStatus: {
      type: String,
      enum: TOPIC_TRACKER_STATUSES,
      default: 'pending',
      index: true,
    },
    /**
     * When sessionStatus is cancelled/postponed, admins approve in Topic Tracker
     * before a ClassCancellation is created (which deducts attendance hours).
     */
    cancellationApprovalStatus: {
      type: String,
      enum: CANCELLATION_APPROVAL_STATUSES,
      default: 'none',
      index: true,
    },
    cancellationApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationApprovedAt: { type: Date, default: null },
    classCancellation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassCancellation',
      default: null,
    },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'topic_tracker_entries' }
);

topicTrackerEntrySchema.index({ schedule: 1, date: 1 }, { unique: true });
topicTrackerEntrySchema.index({ subject: 1, date: 1, trackerStatus: 1 });
topicTrackerEntrySchema.index({ trainer: 1, date: 1 });
topicTrackerEntrySchema.index({ subject: 1, trackerStatus: 1, date: 1 });
topicTrackerEntrySchema.index({ trainer: 1, trackerStatus: 1, date: 1 });
topicTrackerEntrySchema.index({
  sessionStatus: 1,
  cancellationApprovalStatus: 1,
  date: -1,
});

const TopicTrackerEntry = mongoose.model('TopicTrackerEntry', topicTrackerEntrySchema);
export default TopicTrackerEntry;
