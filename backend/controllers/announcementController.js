import AnnouncementReceipt from '../models/AnnouncementReceipt.js';
import { FEEDBACK_ANNOUNCEMENT } from '../utils/feedbackAnnouncement.js';

export const getCurrentAnnouncement = async (req, res) => {
  const receipt = await AnnouncementReceipt.findById(`${FEEDBACK_ANNOUNCEMENT.id}:${req.user._id}`).lean();
  res.json({ announcement: FEEDBACK_ANNOUNCEMENT, dismissed: Boolean(receipt), preview: Boolean(req.isDemo || req.impersonator) });
};
export const dismissAnnouncement = async (req, res) => {
  if (req.impersonator) return res.status(403).json({ message: 'Exit trainer view to dismiss your announcement.' });
  if (req.params.id !== FEEDBACK_ANNOUNCEMENT.id) return res.status(404).json({ message: 'Announcement not found' });
  const key = `${FEEDBACK_ANNOUNCEMENT.id}:${req.user._id}`;
  await AnnouncementReceipt.updateOne({ _id: key }, { $setOnInsert: {
    recipient: req.user._id, announcement: FEEDBACK_ANNOUNCEMENT.id, dismissedAt: new Date(),
  } }, { upsert: true });
  res.json({ dismissed: true });
};
