import mongoose from 'mongoose';
import { TOPIC_TRACKER_STATUSES } from '../utils/topicTrackerConstants.js';

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
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'topic_tracker_entries' }
);

topicTrackerEntrySchema.index({ schedule: 1, date: 1 }, { unique: true });
topicTrackerEntrySchema.index({ subject: 1, date: 1, trackerStatus: 1 });
topicTrackerEntrySchema.index({ trainer: 1, date: 1 });

const TopicTrackerEntry = mongoose.model('TopicTrackerEntry', topicTrackerEntrySchema);
export default TopicTrackerEntry;
