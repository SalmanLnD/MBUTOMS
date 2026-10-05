import mongoose from 'mongoose';
import { notifyWebPushSafely } from '../utils/webPush.js';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorName: { type: String, required: true, trim: true },
    actorRole: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    resource: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    entityPath: { type: String, trim: true, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

// Only newly created inbox alerts push; marking read must not notify again.
notificationSchema.pre('save', function () { this.$locals.pushNew = this.isNew; });
notificationSchema.post('save', async function (doc) {
  if (doc.$locals.pushNew) await notifyWebPushSafely([doc]);
});
notificationSchema.post('insertMany', async function (docs) { await notifyWebPushSafely(docs); });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
