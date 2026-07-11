import express from 'express';
import {
  getVenues,
  getVenueById,
  getVenueMappingReference,
  createVenue,
  updateVenue,
  deleteVenue,
} from '../controllers/venueController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { venueValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router.get('/mapping-reference', asyncHandler(getVenueMappingReference));

router
  .route('/')
  .get(asyncHandler(getVenues))
  .post(authorize('admin', 'campus_manager'), venueValidation, validate, asyncHandler(createVenue));

router
  .route('/:id')
  .get(asyncHandler(getVenueById))
  .put(authorize('admin', 'campus_manager'), venueValidation, validate, asyncHandler(updateVenue))
  .delete(authorize('admin'), asyncHandler(deleteVenue));

export default router;
