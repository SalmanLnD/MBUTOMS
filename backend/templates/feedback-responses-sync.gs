/**
 * MBU TOMS Feedback Responses sync — Extensions → Apps Script in your Google Sheet
 * Run installTriggers() once after pasting this script.
 */
const EXPORT_URL = '__EXPORT_URL__';
const API_KEY = '__API_KEY__';
const SHEET_NAME = 'Feedback Responses';

function syncFeedbackResponses() {
  const url = EXPORT_URL + '?key=' + encodeURIComponent(API_KEY);
  const res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('TOMS API error (' + res.getResponseCode() + '): ' + res.getContentText());
  }

  const payload = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  sheet.clear();
  const rows = payload.rows || [];
  if (!rows.length) {
    sheet.getRange(1, 1).setValue('No feedback responses returned.');
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

  // Wrap comments column so long text stays readable.
  const commentsCol = 7;
  if (maxCols >= commentsCol && padded.length > 1) {
    sheet.getRange(2, commentsCol, padded.length, commentsCol).setWrap(true);
  }

  SpreadsheetApp.flush();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS Feedback')
    .addItem('Refresh now', 'syncFeedbackResponses')
    .addToUi();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'syncFeedbackResponses') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncFeedbackResponses')
    .timeBased()
    .everyMinutes(5)
    .create();

  syncFeedbackResponses();
}
