import WhatsappSyncJob from '../models/WhatsappSyncJob.js';
import { FULL_ACCESS_ROLES } from '../utils/roles.js';
import { clearAttendanceGridCache } from '../utils/attendanceGridCache.js';

const hasFullAccess = (role) => FULL_ACCESS_ROLES.includes(role);

const assertWebhookSecret = (req) => {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return { ok: false, status: 503, message: 'WhatsApp webhook is not configured' };
  if (req.headers['x-webhook-secret'] !== secret) {
    return { ok: false, status: 401, message: 'Invalid webhook secret' };
  }
  return { ok: true };
};

export const requestWhatsappPunchSync = async (req, res) => {
  if (!hasFullAccess(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const lookbackHours = Math.min(
    168,
    Math.max(1, Number(req.body?.lookbackHours) || 48)
  );
  const force = req.body?.force !== false;

  const existingPending = await WhatsappSyncJob.findOne({
    status: { $in: ['pending', 'running'] },
  }).sort({ createdAt: -1 });

  if (existingPending) {
    return res.status(202).json({
      message: 'A WhatsApp punch sync is already queued or running',
      job: existingPending,
    });
  }

  const job = await WhatsappSyncJob.create({
    lookbackHours,
    force,
    requestedBy: req.user._id,
    status: 'pending',
  });

  // Best-effort direct bridge call when CONTROL URL is configured.
  const bridgeUrl = String(process.env.WHATSAPP_BRIDGE_CONTROL_URL || '').trim();
  const bridgeSecret = String(
    process.env.WHATSAPP_BRIDGE_CONTROL_SECRET
    || process.env.WHATSAPP_WEBHOOK_SECRET
    || ''
  ).trim();

  if (bridgeUrl && bridgeSecret) {
    try {
      const response = await fetch(`${bridgeUrl.replace(/\/$/, '')}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-secret': bridgeSecret,
        },
        body: JSON.stringify({ lookbackHours, force }),
        signal: AbortSignal.timeout(120000),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        job.status = 'completed';
        job.completedAt = new Date();
        job.result = payload?.result || payload;
        await job.save();
        clearAttendanceGridCache();
        return res.json({
          message: 'WhatsApp punch sync completed',
          job,
          transport: 'direct',
        });
      }
      job.error = payload?.message || `Bridge returned ${response.status}`;
      await job.save();
    } catch (error) {
      job.error = error.message || 'Direct bridge sync failed';
      await job.save();
    }
  }

  res.status(202).json({
    message: 'WhatsApp punch sync queued. The bridge will pick it up shortly.',
    job,
    transport: 'queued',
  });
};

export const getWhatsappPunchSyncStatus = async (req, res) => {
  if (!hasFullAccess(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const job = await WhatsappSyncJob.findOne().sort({ createdAt: -1 }).lean();
  res.json({ job });
};

export const claimWhatsappPunchSyncJob = async (req, res) => {
  const auth = assertWebhookSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  await WhatsappSyncJob.updateMany(
    { status: 'running', claimedAt: { $lt: staleBefore } },
    { $set: { status: 'pending', claimedAt: null, error: 'Claim timed out; re-queued' } }
  );

  const job = await WhatsappSyncJob.findOneAndUpdate(
    { status: 'pending' },
    { $set: { status: 'running', claimedAt: new Date() } },
    { sort: { createdAt: 1 }, new: true }
  );

  res.json({ job });
};

export const completeWhatsappPunchSyncJob = async (req, res) => {
  const auth = assertWebhookSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const { jobId, ok, result, error } = req.body || {};
  if (!jobId) return res.status(400).json({ message: 'jobId is required' });

  const job = await WhatsappSyncJob.findById(jobId);
  if (!job) return res.status(404).json({ message: 'Sync job not found' });

  job.status = ok ? 'completed' : 'failed';
  job.completedAt = new Date();
  job.result = result || null;
  job.error = ok ? '' : String(error || 'Sync failed');
  await job.save();

  if (ok) clearAttendanceGridCache();

  res.json({ job });
};
