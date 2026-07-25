import express from 'express';
import {
  getPlpSheet,
  updatePlpWeightages,
  upsertPlpFinalRating,
} from '../controllers/plpController.js';
import {
  createCompliance,
  deleteCompliance,
  getComplianceTrainerOptions,
  listCompliance,
} from '../controllers/complianceController.js';
import {
  exportPlpSheetData,
  getPlpGoogleAppsScriptSetup,
  getPlpGoogleSheetStatus,
  linkPlpGoogleSheet,
  unlinkPlpGoogleSheet,
} from '../controllers/plpSheetsController.js';
import { protect, authorizeExact } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePlpExportKey } from '../middleware/plpExportAuth.js';
import { FULL_ACCESS_ROLES } from '../utils/roles.js';

const router = express.Router();

router.get('/export', requirePlpExportKey, asyncHandler(exportPlpSheetData));

router.use(protect);
router.use(authorizeExact(...FULL_ACCESS_ROLES));

router.get('/', asyncHandler(getPlpSheet));
router.put('/weightages', asyncHandler(updatePlpWeightages));

router.get('/sheets/status', asyncHandler(getPlpGoogleSheetStatus));
router.get('/sheets/apps-script/setup', asyncHandler(getPlpGoogleAppsScriptSetup));
router.post('/sheets/link', asyncHandler(linkPlpGoogleSheet));
router.delete('/sheets/link', asyncHandler(unlinkPlpGoogleSheet));

router.get('/compliance/trainers', asyncHandler(getComplianceTrainerOptions));
router.get('/compliance', asyncHandler(listCompliance));
router.post('/compliance', asyncHandler(createCompliance));
router.delete('/compliance/:id', asyncHandler(deleteCompliance));

router.put('/:trainerId/final', asyncHandler(upsertPlpFinalRating));

export default router;
