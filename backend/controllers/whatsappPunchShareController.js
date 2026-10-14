import WhatsappPunchShare from '../models/WhatsappPunchShare.js';
import { downloadPunchPhoto } from '../services/punchPhotoDrive.js';

const assertWebhookSecret = (req) => {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return { ok: false, status: 503, message: 'WhatsApp webhook is not configured' };
  if (req.headers['x-webhook-secret'] !== secret) {
    return { ok: false, status: 401, message: 'Invalid webhook secret' };
  }
  return { ok: true };
};

const releaseStaleShares = async () => {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  await WhatsappPunchShare.updateMany(
    { status: 'sending', claimedAt: { $lt: staleBefore }, attempts: { $gte: 3 } },
    { $set: { status: 'failed', error: 'Send timed out' } }
  );
  await WhatsappPunchShare.updateMany(
    { status: 'sending', claimedAt: { $lt: staleBefore }, attempts: { $lt: 3 } },
    { $set: { status: 'pending', claimedAt: null } }
  );
};

export const claimWhatsappPunchShare = async (req, res) => {
  const auth = assertWebhookSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  await releaseStaleShares();
  const job = await WhatsappPunchShare.findOneAndUpdate(
    { status: 'pending' },
    { $set: { status: 'sending', claimedAt: new Date() } },
    { sort: { createdAt: 1 }, new: true }
  ).select('_id caption groupName');

  res.json({ job });
};

export const downloadWhatsappPunchSharePhoto = async (req, res) => {
  const auth = assertWebhookSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const job = await WhatsappPunchShare.findById(req.params.id).select('driveFileId status');
  if (!job || job.status === 'failed') {
    return res.status(404).json({ message: 'Punch share not found' });
  }

  const buffer = await downloadPunchPhoto(job.driveFileId);
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'no-store');
  res.send(buffer);
};

export const completeWhatsappPunchShare = async (req, res) => {
  const auth = assertWebhookSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const { jobId, ok, error } = req.body || {};
  if (!jobId) return res.status(400).json({ message: 'jobId is required' });

  const job = await WhatsappPunchShare.findById(jobId);
  if (!job) return res.status(404).json({ message: 'Punch share not found' });

  if (ok) {
    job.status = 'sent';
    job.sentAt = new Date();
    job.error = '';
  } else {
    job.attempts += 1;
    job.error = String(error || 'Send failed').slice(0, 300);
    job.claimedAt = null;
    job.status = job.attempts >= 3 ? 'failed' : 'pending';
  }
  await job.save();
  res.json({ job: { _id: job._id, status: job.status } });
};
