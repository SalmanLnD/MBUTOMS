/**
 * MBU TOMS Timetable sync — Extensions → Apps Script in your Google Sheet
 * Run installTriggers() once after pasting this script.
 */
const EXPORT_URL = '__EXPORT_URL__';
const API_KEY = '__API_KEY__';
const SHEET_NAME = 'Timetable';

function fetchTomsExport() {
  const url = EXPORT_URL + '?key=' + encodeURIComponent(API_KEY);
  const healthUrl = EXPORT_URL.replace(/\/api\/.+$/, '/api/health');
  const headers = { 'ngrok-skip-browser-warning': 'true' };
  let lastMessage = '';

  for (let attempt = 1; attempt <= 6; attempt++) {
    UrlFetchApp.fetch(healthUrl, { muteHttpExceptions: true, headers: headers });
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: headers });
    const code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    }
    lastMessage = 'TOMS API error (' + code + '): ' + response.getContentText();
    if (code !== 502 && code !== 503 && code !== 504) {
      throw new Error(lastMessage);
    }
    Utilities.sleep(8000);
  }

  throw new Error(lastMessage || 'TOMS API did not become ready');
}

function syncTimetable() {
  const payload = fetchTomsExport();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  sheet.clear();
  const rows = payload.rows || [];
  if (!rows.length) {
    sheet.getRange(1, 1).setValue('No timetable data returned.');
    return;
  }

  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 1);
  const padded = rows.map((row) => {
    const copy = row.slice();
    while (copy.length < maxCols) {
      copy.push('');
    }
    return copy;
  });

  sheet.getRange(1, 1, padded.length, maxCols).setValues(padded);
  sheet.getRange(1, 1, 1, maxCols).setFontWeight('bold');
  SpreadsheetApp.flush();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS Timetable')
    .addItem('Refresh now', 'syncTimetable')
    .addToUi();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'syncTimetable') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncTimetable')
    .timeBased()
    .everyMinutes(5)
    .create();

  syncTimetable();
}
