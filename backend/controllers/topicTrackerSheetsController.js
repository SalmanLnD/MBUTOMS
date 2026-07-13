import {
  getTopicTrackerAppsScriptStatus,
  getTopicTrackerAppsScriptSetup as buildTopicTrackerAppsScriptSetup,
  linkTopicTrackerSpreadsheetUrl,
  unlinkTopicTrackerSpreadsheet,
} from '../services/topicTrackerSheetsService.js';

export const getTopicTrackerSheetStatus = async (req, res) => {
  res.json(await getTopicTrackerAppsScriptStatus());
};

export const getTopicTrackerAppsScriptSetup = async (req, res) => {
  res.json(await buildTopicTrackerAppsScriptSetup(req));
};

export const linkTopicTrackerSheet = async (req, res) => {
  const { spreadsheetUrl } = req.body || {};
  if (!spreadsheetUrl) {
    return res.status(400).json({ message: 'spreadsheetUrl is required' });
  }
  const value = await linkTopicTrackerSpreadsheetUrl(spreadsheetUrl);
  res.status(201).json({
    linked: true,
    spreadsheetUrl: value.spreadsheetUrl,
    linkedAt: value.linkedAt,
  });
};

export const unlinkTopicTrackerSheet = async (req, res) => {
  await unlinkTopicTrackerSpreadsheet();
  res.json({ linked: false });
};
