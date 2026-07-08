import express from 'express';
import { recordWhatsappPunchIn } from '../controllers/attendanceWebhookController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// Public (secret-protected) machine-to-machine endpoints. No user JWT.
router.post('/whatsapp-punch', asyncHandler(recordWhatsappPunchIn));

export default router;
