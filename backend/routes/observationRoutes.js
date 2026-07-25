import express from 'express';
import { getObservations, upsertObservation } from '../controllers/observationController.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  hasEvaluatorObservationAccess,
  hasFullObservationAccess,
} from '../utils/evaluatorAccess.js';

const router = express.Router();

const authorizeObservationAccess = (req, res, next) => {
  if (req.impersonator) {
    return res.status(403).json({
      message: 'Exit trainer view before using admin features.',
    });
  }

  if (hasFullObservationAccess(req.user) || hasEvaluatorObservationAccess(req.user)) {
    return next();
  }

  return res.status(403).json({
    message: `Role '${req.user?.role}' is not authorized for this action`,
  });
};

router.use(protect);
router.use(authorizeObservationAccess);

router.get('/', asyncHandler(getObservations));
router.put('/:trainerId', asyncHandler(upsertObservation));

export default router;
