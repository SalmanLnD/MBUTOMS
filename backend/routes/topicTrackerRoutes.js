import express from 'express';
import {
  getTopicTrackerOverview,
  getTopicTrackerSessions,
  upsertTopicTrackerEntry,
  updateTopicTrackerStatus,
  exportTopicTrackerForSheets,
} from '../controllers/topicTrackerController.js';
import {
  getTopicTrackerSheetStatus,
  getTopicTrackerAppsScriptSetup,
  linkTopicTrackerSheet,
  unlinkTopicTrackerSheet,
} from '../controllers/topicTrackerSheetsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireTopicTrackerExportKey } from '../middleware/topicTrackerExportAuth.js';

const router = express.Router();

router.get('/export', requireTopicTrackerExportKey, asyncHandler(exportTopicTrackerForSheets));

router.use(protect);

router.get('/overview', asyncHandler(getTopicTrackerOverview));
router.get('/sessions', asyncHandler(getTopicTrackerSessions));
router.put('/entries', asyncHandler(upsertTopicTrackerEntry));
router.patch('/entries/:id/status', asyncHandler(updateTopicTrackerStatus));

router.get('/sheets/status', asyncHandler(getTopicTrackerSheetStatus));
router.get(
  '/sheets/apps-script/setup',
  authorize('admin', 'campus_manager'),
  asyncHandler(getTopicTrackerAppsScriptSetup)
);
router.post(
  '/sheets/link',
  authorize('admin', 'campus_manager'),
  asyncHandler(linkTopicTrackerSheet)
);
router.delete(
  '/sheets/link',
  authorize('admin', 'campus_manager'),
  asyncHandler(unlinkTopicTrackerSheet)
);

export default router;
