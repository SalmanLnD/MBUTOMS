import express from 'express';
import { getPlpSheet } from '../controllers/plpController.js';
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
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePlpExportKey } from '../middleware/plpExportAuth.js';

const router = express.Router();

router.get('/export', requirePlpExportKey, asyncHandler(exportPlpSheetData));

router.use(protect);
router.use(authorize('admin', 'campus_manager'));

router.get('/', asyncHandler(getPlpSheet));

router.get('/sheets/status', asyncHandler(getPlpGoogleSheetStatus));
router.get('/sheets/apps-script/setup', asyncHandler(getPlpGoogleAppsScriptSetup));
router.post('/sheets/link', asyncHandler(linkPlpGoogleSheet));
router.delete('/sheets/link', asyncHandler(unlinkPlpGoogleSheet));

router.get('/compliance/trainers', asyncHandler(getComplianceTrainerOptions));
router.get('/compliance', asyncHandler(listCompliance));
router.post('/compliance', asyncHandler(createCompliance));
router.delete('/compliance/:id', asyncHandler(deleteCompliance));

export default router;
