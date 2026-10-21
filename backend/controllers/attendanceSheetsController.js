import {
  exportTrainerAttendance,
  exportRtet,
  getAttendanceAppsScriptSetup,
  getAttendanceSheetStatus,
  linkAttendanceSpreadsheet,
  unlinkAttendanceSpreadsheet,
} from '../services/attendanceSheetsService.js';
import { buildRtetDebugForSubjectDate } from '../utils/rtetExport.js';

export const exportTrainerAttendanceForSheets = async (req, res) => {
  if (req.query?.syncVersion !== '2') return res.status(409).json({
    message: 'Update the attendance Apps Script from TOMS Sheet setup before syncing. Version 2 preserves Exit history and restores reactivated trainers.',
  });
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

export const exportRtetForSheets = async (req, res) => {
  res.json(await exportRtet());
};

export const debugRtetForSubjectDate = async (req, res) => {
  const { subjectCode, date } = req.query || {};
  res.json(await buildRtetDebugForSubjectDate({ subjectCode, dateInput: date }));
};
