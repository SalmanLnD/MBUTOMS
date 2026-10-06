import express from 'express';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getCurrentAnnouncement, dismissAnnouncement } from '../controllers/announcementController.js';
const router = express.Router();
router.use(protect);
router.get('/current', asyncHandler(getCurrentAnnouncement));
router.post('/:id/dismiss', asyncHandler(dismissAnnouncement));
export default router;
