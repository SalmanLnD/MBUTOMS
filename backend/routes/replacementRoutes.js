import express from 'express';
import {
  getReplacementSuggestions,
  getAllReplacements,
  assignReplacement,
  getTrainerAvailability,
  getTrainerSlotsForReplacement,
  createSlotReplacementRequest,
  getBulkReplacementSuggestions,
  assignBulkReplacement,
  removeReplacement,
  cancelReplacement,
} from '../controllers/replacementController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'campus_manager'));

router.get('/all', asyncHandler(getAllReplacements));
router.get('/pending', asyncHandler(getAllReplacements));
router.get('/availability', asyncHandler(getTrainerAvailability));
router.get('/trainer-slots', asyncHandler(getTrainerSlotsForReplacement));
router.get('/suggestions/:scheduleId', asyncHandler(getReplacementSuggestions));
router.get('/bulk-suggestions', asyncHandler(getBulkReplacementSuggestions));
router.post('/slot-request', asyncHandler(createSlotReplacementRequest));
router.post('/assign', asyncHandler(assignReplacement));
router.post('/bulk-assign', asyncHandler(assignBulkReplacement));
router.post('/remove', asyncHandler(removeReplacement));
router.post('/cancel', asyncHandler(cancelReplacement));

export default router;
