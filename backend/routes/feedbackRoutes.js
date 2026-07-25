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
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireFeedbackExportKey } from '../middleware/feedbackExportAuth.js';
import { isAuthorizedRole, ROLES } from '../utils/roles.js';

const FEEDBACK_ACCESS_ROLES = [ROLES.ADMIN, ROLES.CAMPUS_MANAGER];

const authorizeFeedbackAccess = (req, res, next) => {
  // Allow subject-coordinator preview under impersonation (they share campus_manager access).
  // Block only when the viewed account would not normally use Feedback.
  if (req.impersonator && !isAuthorizedRole(req.user?.role, FEEDBACK_ACCESS_ROLES)) {
    return res.status(403).json({
      message: 'Exit trainer view before using admin features.',
    });
  }

  if (!isAuthorizedRole(req.user?.role, FEEDBACK_ACCESS_ROLES)) {
    return res.status(403).json({
      message: `Role '${req.user?.role}' is not authorized for this action`,
    });
  }
  next();
};

const router = express.Router();

router.get('/public/:slug', asyncHandler(getPublicFeedbackForm));
router.post('/public/:slug/submit', asyncHandler(submitPublicFeedback));
router.get('/export', requireFeedbackExportKey, asyncHandler(exportFeedbackResponsesForSheets));

router.use(protect);
router.use(authorizeFeedbackAccess);

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
