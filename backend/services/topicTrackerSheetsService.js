import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AppSetting from '../models/AppSetting.js';
import { buildTopicTrackerExportRows } from '../utils/topicTrackerSessions.js';
import { getPublicApiBaseUrl } from '../services/appsScriptSheetsService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPREADSHEET_SETTING_KEY = 'topic_tracker_spreadsheet';
const EXPORT_KEY_SETTING = 'topic_tracker_export_api_key';

const getExportKey = async () => {
  const setting = await AppSetting.findOne({ key: EXPORT_KEY_SETTING }).lean();
  return setting?.value || null;
};

export const getOrCreateTopicTrackerExportKey = async () => {
  const existing = await getExportKey();
  if (existing) return existing;

  const key = crypto.randomBytes(24).toString('hex');
  await AppSetting.findOneAndUpdate(
    { key: EXPORT_KEY_SETTING },
    { key: EXPORT_KEY_SETTING, value: key },
    { upsert: true, new: true }
  );
  return key;
};

export const validateTopicTrackerExportKey = async (key) => {
  const stored = await getExportKey();
  return Boolean(stored && key && key === stored);
};

export const getLinkedTopicTrackerSheet = async () => {
  const setting = await AppSetting.findOne({ key: SPREADSHEET_SETTING_KEY }).lean();
  return setting?.value || null;
};

const saveLinkedSheet = async (value) => {
  await AppSetting.findOneAndUpdate(
    { key: SPREADSHEET_SETTING_KEY },
    { key: SPREADSHEET_SETTING_KEY, value },
    { upsert: true, new: true }
  );
  return value;
};

const normalizeSpreadsheetUrl = (url) => {
  const trimmed = String(url || '').trim();
  if (!trimmed.includes('docs.google.com/spreadsheets')) {
    const error = new Error('Paste a valid Google Sheets URL (docs.google.com/spreadsheets/...).');
    error.statusCode = 400;
    throw error;
  }
  return trimmed.split('#')[0].split('?')[0];
};

export const getTopicTrackerAppsScriptStatus = async () => {
  const linked = await getLinkedTopicTrackerSheet();
  const exportKey = await getExportKey();
  return {
    mode: 'apps_script',
    linked: Boolean(linked?.spreadsheetUrl),
    spreadsheetUrl: linked?.spreadsheetUrl || null,
    linkedAt: linked?.linkedAt || null,
    exportReady: Boolean(exportKey),
  };
};

export const getTopicTrackerAppsScriptSetup = async (req) => {
  const apiKey = await getOrCreateTopicTrackerExportKey();
  const baseUrl = getPublicApiBaseUrl(req);
  const exportUrl = `${baseUrl}/api/topic-tracker/export`;

  const templatePath = path.join(__dirname, '../templates/topic-tracker-sync.gs');
  const template = fs.readFileSync(templatePath, 'utf8');
  const script = template
    .replaceAll('__EXPORT_URL__', exportUrl)
    .replaceAll('__API_KEY__', apiKey);

  return {
    exportUrl,
    apiKey,
    script,
    steps: [
      'Create a new Google Sheet (or open your existing Topic Tracker workbook).',
      'Extensions → Apps Script, replace any old script with the script below, and save.',
      'Run installTriggers once (authorize when Google asks).',
      'Use menu TOMS Topic Tracker → Refresh now — this fills the master Topic Tracker tab plus one tab per trainer (Employee ID - Name).',
      'Paste your sheet URL below and click Save link (skip if already linked).',
    ],
    note:
      'Google Apps Script runs on Google servers and cannot call localhost. '
      + 'Use your deployed API URL (set API_PUBLIC_URL in backend .env) or a tunnel like ngrok for local testing. '
      + 'Do not hand-edit the synced Topic Tracker or trainer tabs — each refresh clears and rewrites them from TOMS.',
  };
};

export const linkTopicTrackerSpreadsheetUrl = async (spreadsheetUrl) => {
  const url = normalizeSpreadsheetUrl(spreadsheetUrl);
  return saveLinkedSheet({
    mode: 'apps_script',
    spreadsheetUrl: url,
    linkedAt: new Date().toISOString(),
  });
};

export const unlinkTopicTrackerSpreadsheet = async () => {
  await AppSetting.deleteOne({ key: SPREADSHEET_SETTING_KEY });
  return { unlinked: true };
};

export const exportTopicTrackerRows = async () => buildTopicTrackerExportRows();
