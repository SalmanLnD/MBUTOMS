import express from 'express';
import { recordWhatsappPunchIn } from '../controllers/attendanceWebhookController.js';
import {
  claimWhatsappPunchSyncJob,
  completeWhatsappPunchSyncJob,
} from '../controllers/whatsappSyncController.js';
import {
  claimWhatsappPunchShare,
  completeWhatsappPunchShare,
  downloadWhatsappPunchSharePhoto,
} from '../controllers/whatsappPunchShareController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// Public (secret-protected) machine-to-machine endpoints. No user JWT.
router.post('/whatsapp-punch', asyncHandler(recordWhatsappPunchIn));
router.get('/whatsapp-sync/claim', asyncHandler(claimWhatsappPunchSyncJob));
router.post('/whatsapp-sync/complete', asyncHandler(completeWhatsappPunchSyncJob));
router.get('/whatsapp-punch-share/claim', asyncHandler(claimWhatsappPunchShare));
router.get('/whatsapp-punch-share/:id/photo', asyncHandler(downloadWhatsappPunchSharePhoto));
router.post('/whatsapp-punch-share/complete', asyncHandler(completeWhatsappPunchShare));

export default router;
