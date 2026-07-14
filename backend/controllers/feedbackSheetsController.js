import {
  getFeedbackAppsScriptStatus,
  getFeedbackAppsScriptSetup as buildFeedbackAppsScriptSetup,
  linkFeedbackSpreadsheetUrl,
  unlinkFeedbackSpreadsheet,
} from '../services/feedbackSheetsService.js';

export const getFeedbackSheetStatus = async (req, res) => {
  res.json(await getFeedbackAppsScriptStatus());
};

export const getFeedbackAppsScriptSetup = async (req, res) => {
  res.json(await buildFeedbackAppsScriptSetup(req));
};

export const linkFeedbackSheet = async (req, res) => {
  const { spreadsheetUrl } = req.body || {};
  if (!spreadsheetUrl) {
    return res.status(400).json({ message: 'spreadsheetUrl is required' });
  }
  const value = await linkFeedbackSpreadsheetUrl(spreadsheetUrl);
  res.status(201).json({
    linked: true,
    spreadsheetUrl: value.spreadsheetUrl,
    linkedAt: value.linkedAt,
  });
};

export const unlinkFeedbackSheet = async (req, res) => {
  await unlinkFeedbackSpreadsheet();
  res.json({ linked: false });
};
