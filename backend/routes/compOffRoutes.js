import express from 'express';
import { body } from 'express-validator';
import { protect, authorizeExact } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { FULL_ACCESS_ROLES } from '../utils/roles.js';
import {
  listCompOffs,
  getCompOffSummary,
  createCompOff,
  updateCompOff,
  deleteCompOff,
} from '../controllers/compOffController.js';

const router = express.Router();

const compOffValidation = [
  body('employeeId').trim().notEmpty().withMessage('Employee ID is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('base').trim().notEmpty().withMessage('Base is required'),
  body('dateWorkedOn').isISO8601().withMessage('Date worked on is required'),
  body('uniqueId').trim().notEmpty().withMessage('Unique ID is required'),
  body('count').isFloat({ gt: 0 }).withMessage('Count must be greater than zero'),
];

router.use(protect);

router.get('/', asyncHandler(listCompOffs));
router.get('/summary', asyncHandler(getCompOffSummary));
router.get('/summary/trainer/:trainerId', asyncHandler(getCompOffSummary));

router.post(
  '/',
  authorizeExact(...FULL_ACCESS_ROLES),
  compOffValidation,
  validate,
  asyncHandler(createCompOff)
);

router.put(
  '/:id',
  authorizeExact(...FULL_ACCESS_ROLES),
  asyncHandler(updateCompOff)
);

router.delete(
  '/:id',
  authorizeExact(...FULL_ACCESS_ROLES),
  asyncHandler(deleteCompOff)
);

export default router;
