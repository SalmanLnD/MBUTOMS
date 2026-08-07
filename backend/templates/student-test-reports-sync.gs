/**
 * MBU TOMS Monthly Test Reports sync — Extensions → Apps Script
 * Run installTriggers() once after pasting this script.
 */
const EXPORT_URL = '__EXPORT_URL__';
const API_KEY = '__API_KEY__';
const SUMMARY_SHEET_NAME = 'Summary';
const MARKS_SHEET_NAME = 'Monthly Test Marks';

function syncStudentTestReports() {
  const month = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM');
  const url = EXPORT_URL + '?key=' + encodeURIComponent(API_KEY) + '&month=' + encodeURIComponent(month);
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  if (response.getResponseCode() !== 200) {
    throw new Error(
      'TOMS API error (' + response.getResponseCode() + '): ' + response.getContentText()
    );
  }

  const payload = JSON.parse(response.getContentText());
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  writeSheetValues(
    ensureSheet(spreadsheet, payload.summarySheetName || SUMMARY_SHEET_NAME),
    payload.summaryRows || []
  );
  writeSheetValues(
    ensureSheet(spreadsheet, payload.marksSheetName || MARKS_SHEET_NAME),
    payload.marksRows || []
  );
  SpreadsheetApp.flush();
}

function ensureSheet(spreadsheet, name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}

function writeSheetValues(sheet, rows) {
  sheet.clear();
  if (!rows.length) {
    sheet.getRange(1, 1).setValue('No monthly test report data returned.');
    return;
  }

  const maxColumns = rows.reduce(function (max, row) {
    return Math.max(max, row.length);
  }, 1);
  const maxRows = rows.length;

  if (sheet.getMaxColumns() < maxColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), maxColumns - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < maxRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), maxRows - sheet.getMaxRows());
  }

  const padded = rows.map(function (row) {
    const copy = row.slice();
    while (copy.length < maxColumns) copy.push('');
    return copy;
  });
  sheet.getRange(1, 1, maxRows, maxColumns).setValues(padded);
  sheet.getRange(1, 1, 1, maxColumns).setFontWeight('bold').setBackground('#d9ead3');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, maxColumns);
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncStudentTestReports') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('syncStudentTestReports')
    .timeBased()
    .everyMinutes(5)
    .create();
  syncStudentTestReports();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS Test Reports')
    .addItem('Refresh now', 'syncStudentTestReports')
    .addItem('Install 5-minute refresh', 'installTriggers')
    .addToUi();
}
