import express from 'express';
import {
  getFeedbackSummary,
  getFeedbackResponses,
  getFeedbackForms,
  getCurrentMonthForm,
  createCurrentMonthForm,
  updateFeedbackForm,
  publishFeedbackForm,
  getPublicFeedbackForm,
  submitPublicFeedback,
  exportFeedbackResponsesForSheets,
} from '../controllers/feedbackController.js';
import {
  getFeedbackSheetStatus,
  getFeedbackAppsScriptSetup,
  linkFeedbackSheet,
  unlinkFeedbackSheet,
} from '../controllers/feedbackSheetsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireFeedbackExportKey } from '../middleware/feedbackExportAuth.js';

const router = express.Router();

router.get('/public/:slug', asyncHandler(getPublicFeedbackForm));
router.post('/public/:slug/submit', asyncHandler(submitPublicFeedback));
router.get('/export', requireFeedbackExportKey, asyncHandler(exportFeedbackResponsesForSheets));

router.use(protect);
router.use(authorize('admin', 'campus_manager'));

router.get('/summary', asyncHandler(getFeedbackSummary));
router.get('/responses', asyncHandler(getFeedbackResponses));
router.get('/forms', asyncHandler(getFeedbackForms));
router.get('/forms/current', asyncHandler(getCurrentMonthForm));
router.post('/forms/current', asyncHandler(createCurrentMonthForm));
router.put('/forms/:id', asyncHandler(updateFeedbackForm));
router.post('/forms/:id/publish', asyncHandler(publishFeedbackForm));

router.get('/sheets/status', asyncHandler(getFeedbackSheetStatus));
router.get('/sheets/apps-script/setup', asyncHandler(getFeedbackAppsScriptSetup));
router.post('/sheets/link', asyncHandler(linkFeedbackSheet));
router.delete('/sheets/link', asyncHandler(unlinkFeedbackSheet));

export default router;
