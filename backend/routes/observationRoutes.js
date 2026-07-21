import express from 'express';
import { getObservations, upsertObservation } from '../controllers/observationController.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'campus_manager'));

router.get('/', asyncHandler(getObservations));
router.put('/:trainerId', asyncHandler(upsertObservation));

export default router;
