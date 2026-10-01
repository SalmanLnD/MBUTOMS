import express from 'express';
import { protect, authorizeExact } from '../middleware/auth.js';
import { aiChat, aiUsage, AI_ACCESS_ROLES } from '../ai/aiController.js';

export const createAiRouter = ({ authentication = protect, controller = aiChat, usageController = aiUsage } = {}) => {
  const router = express.Router();
  router.post('/chat', authentication, authorizeExact(...AI_ACCESS_ROLES), controller);
  router.get('/usage', authentication, authorizeExact(...AI_ACCESS_ROLES), usageController);
  return router;
};

export default createAiRouter();
