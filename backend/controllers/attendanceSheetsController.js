import {
  exportTrainerAttendance,
  getAttendanceAppsScriptSetup,
  getAttendanceSheetStatus,
  linkAttendanceSpreadsheet,
  unlinkAttendanceSpreadsheet,
} from '../services/attendanceSheetsService.js';

export const exportTrainerAttendanceForSheets = async (req, res) => {
  res.json(await exportTrainerAttendance());
};

export const getTrainerAttendanceSheetStatus = async (req, res) => {
  res.json(await getAttendanceSheetStatus());
};

export const getTrainerAttendanceAppsScriptSetup = async (req, res) => {
  res.json(await getAttendanceAppsScriptSetup(req));
};

export const linkTrainerAttendanceSheet = async (req, res) => {
  const { spreadsheetUrl } = req.body || {};
  if (!spreadsheetUrl) {
    return res.status(400).json({ message: 'spreadsheetUrl is required' });
  }
  const value = await linkAttendanceSpreadsheet(spreadsheetUrl);
  res.status(201).json({
    linked: true,
    spreadsheetUrl: value.spreadsheetUrl,
    linkedAt: value.linkedAt,
  });
};

export const unlinkTrainerAttendanceSheet = async (req, res) => {
  await unlinkAttendanceSpreadsheet();
  res.json({ linked: false });
};
