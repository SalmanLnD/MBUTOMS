import express from 'express';
import {
  getTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
} from '../controllers/ticketController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/roles.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ticketValidation, ticketStatusValidation } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(asyncHandler(getTickets))
  .post(ticketValidation, validate, asyncHandler(createTicket));

router.route('/:id')
  .get(asyncHandler(getTicketById));

router.put(
  '/:id/status',
  authorize(ROLES.ADMIN),
  ticketStatusValidation,
  validate,
  asyncHandler(updateTicketStatus)
);

export default router;
