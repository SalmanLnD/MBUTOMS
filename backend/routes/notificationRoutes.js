import express from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getPushConfig, savePushSubscription, removePushSubscription } from '../controllers/pushController.js';

const router = express.Router();

router.use(protect);

router.get('/', asyncHandler(getNotifications));
router.get('/push/config', getPushConfig);
router.post('/push/subscription', asyncHandler(savePushSubscription));
router.delete('/push/subscription', asyncHandler(removePushSubscription));
router.patch('/read-all', asyncHandler(markAllNotificationsRead));
router.patch('/:id/read', asyncHandler(markNotificationRead));

export default router;
