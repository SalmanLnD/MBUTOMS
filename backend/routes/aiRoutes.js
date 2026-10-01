import express from 'express';
import { protect, authorizeExact } from '../middleware/auth.js';
import { aiChat, AI_ACCESS_ROLES } from '../ai/aiController.js';

export const createAiRouter = ({ authentication = protect, controller = aiChat } = {}) => {
  const router = express.Router();
  router.post('/chat', authentication, authorizeExact(...AI_ACCESS_ROLES), controller);
  return router;
};

export default createAiRouter();
