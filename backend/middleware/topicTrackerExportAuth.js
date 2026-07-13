import { validateTopicTrackerExportKey } from '../services/topicTrackerSheetsService.js';

export const requireTopicTrackerExportKey = async (req, res, next) => {
  const key = req.query.key || req.headers['x-sheets-key'];
  const valid = await validateTopicTrackerExportKey(key);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid or missing export key' });
  }
  next();
};
