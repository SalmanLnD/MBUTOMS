/**
 * MBU TOMS Trainer Attendance sync — Extensions → Apps Script
 * Run installTriggers() once after pasting this script.
 */
const EXPORT_URL = '__EXPORT_URL__';
const RTET_EXPORT_URL = '__RTET_EXPORT_URL__';
const API_KEY = '__API_KEY__';
const DEFAULT_SHEET_NAME = 'Trainer Attendance from July 13';
const RTET_SHEET_NAME = 'rtet';

function fetchTomsJson(url) {
  const headers = {
    'x-sheets-key': API_KEY,
    'ngrok-skip-browser-warning': 'true',
  };
  let lastMessage = '';

  for (var attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      Utilities.sleep(30000);
    }
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: headers,
    });
    var code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    }
    var body = String(response.getContentText() || '');
    lastMessage = 'TOMS API error (' + code + '): ' + body.slice(0, 160);
    if (code === 429 || body.indexOf('Just a moment') !== -1) {
      throw new Error(
        'TOMS API error (' + code + '): Cloudflare blocked the sheet sync. '
        + 'Wait one minute, then use Refresh now. Do not run installTriggers again.'
      );
    }
    if (code !== 502 && code !== 503 && code !== 504) {
      throw new Error(lastMessage);
    }
  }

  throw new Error(
    lastMessage + ' The API may be busy. Wait 30 seconds and use Refresh now once.'
  );
}

function syncTrainerAttendance() {
  var payload = fetchTomsJson(EXPORT_URL);
  var rows = payload.rows || [];
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = payload.sheetName || DEFAULT_SHEET_NAME;
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (!rows.length) {
    sheet.clear();
    sheet.getRange(1, 1).setValue('No trainer attendance returned.');
  } else {
    var maxColumns = rows.reduce(function(max, row) { return Math.max(max, row.length); }, 1);
    var maxRows = rows.length;
    if (sheet.getMaxColumns() < maxColumns) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), maxColumns - sheet.getMaxColumns());
    }
    if (sheet.getMaxRows() < maxRows) {
      sheet.insertRowsAfter(sheet.getMaxRows(), maxRows - sheet.getMaxRows());
    }

    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
    sheet.clear();

    var padded = rows.map(function(row) {
      var copy = row.slice();
      while (copy.length < maxColumns) copy.push('');
      return copy;
    });
    sheet.getRange(1, 1, maxRows, maxColumns).setValues(padded);

    var groupSize = payload.dateGroupSize || 4;
    for (var column = 3; column <= maxColumns; column += groupSize) {
      sheet.getRange(1, column, 1, groupSize).merge();
    }

    sheet.setFrozenRows(payload.frozenRows || 2);
    sheet.setFrozenColumns(payload.frozenColumns || 2);

    var usedRange = sheet.getRange(1, 1, maxRows, maxColumns);
    usedRange
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true)
      .setBorder(true, true, true, true, true, true);

    sheet.getRange(1, 1, 2, maxColumns)
      .setFontWeight('bold')
      .setBackground('#d9ead3');
    sheet.getRange(3, 1, Math.max(maxRows - 2, 1), 2).setFontWeight('bold');
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 100);
    if (maxColumns > 2) {
      sheet.setColumnWidths(3, maxColumns - 2, 90);
    }
  }

  syncRTET(spreadsheet);
  SpreadsheetApp.flush();
}

/**
 * Fetch the RTET payload from the API and write the rtet sub-sheet from scratch.
 *
 * Layout:
 *   Row 1  : header — "Subject" | date1 | date2 | … | "Total"
 *   Rows 2… : subject name | hours per date … | row total
 *
 * All dates are always written (including weekend dates) with zeros when there are no executed hours.
 * The sheet is always cleared and re-created from the API response.
 */
function syncRTET(spreadsheet) {
  var rtetPayload;
  try {
    rtetPayload = fetchTomsJson(RTET_EXPORT_URL);
  } catch (e) {
    // Attendance sheet already succeeded; log RTET failure without throwing.
    Logger.log('RTET fetch failed: ' + e.message);
    return;
  }

  var dateLabels = rtetPayload.dateLabels || [];
  var subjects = rtetPayload.subjects || [];

  var rtetSheet = spreadsheet.getSheetByName(RTET_SHEET_NAME);
  if (!rtetSheet) {
    rtetSheet = spreadsheet.insertSheet(RTET_SHEET_NAME);
  }

  if (!dateLabels.length || !subjects.length) {
    rtetSheet.clear();
    rtetSheet.getRange(1, 1).setValue('No RTET data available.');
    return;
  }

  // Always include all dates (weekends included). If a subject has no hours,
  // the value is treated as 0.
  var activeDateIndices = [];
  for (var j = 0; j < dateLabels.length; j++) {
    activeDateIndices.push(j);
  }

  var activeDateLabels = dateLabels.slice();

  // Build output rows.
  var out = [];

  // Header row.
  out.push(['Subject'].concat(activeDateLabels).concat(['Total']));

  // One row per subject.
  subjects.forEach(function(subject) {
    var activeHours = activeDateIndices.map(function(j) { return subject.hours[j] || 0; });
    var rowTotal = activeHours.reduce(function(sum, h) { return Math.round((sum + h) * 10) / 10; }, 0);
    out.push([subject.name].concat(activeHours).concat([rowTotal]));
  });

  // Column totals row.
  var colTotals = activeDateIndices.map(function(j) {
    return subjects.reduce(function(sum, s) { return Math.round((sum + (s.hours[j] || 0)) * 10) / 10; }, 0);
  });
  var grandTotal = colTotals.reduce(function(sum, h) { return Math.round((sum + h) * 10) / 10; }, 0);
  out.push(['Total'].concat(colTotals).concat([grandTotal]));

  var numRows = out.length;
  var numCols = out[0].length;

  // Resize sheet to fit.
  if (rtetSheet.getMaxColumns() < numCols) {
    rtetSheet.insertColumnsAfter(rtetSheet.getMaxColumns(), numCols - rtetSheet.getMaxColumns());
  }
  if (rtetSheet.getMaxRows() < numRows) {
    rtetSheet.insertRowsAfter(rtetSheet.getMaxRows(), numRows - rtetSheet.getMaxRows());
  }

  rtetSheet.clear();
  rtetSheet.getRange(1, 1, numRows, numCols).setValues(out);

  // Freeze header row and Subject column.
  rtetSheet.setFrozenRows(1);
  rtetSheet.setFrozenColumns(1);

  // Styling.
  var allRange = rtetSheet.getRange(1, 1, numRows, numCols);
  allRange
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(false)
    .setBorder(true, true, true, true, true, true);

  // Header row styling.
  rtetSheet.getRange(1, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground('#cfe2f3');

  // Subject name column — left-align and bold.
  rtetSheet.getRange(1, 1, numRows, 1)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');

  // Totals row (last row) styling.
  rtetSheet.getRange(numRows, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground('#fff2cc');

  // Grand total cell styling.
  rtetSheet.getRange(numRows, numCols)
    .setBackground('#f9cb9c');

  // Column widths.
  rtetSheet.setColumnWidth(1, 280);
  if (numCols > 1) {
    rtetSheet.setColumnWidths(2, numCols - 1, 110);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS Attendance')
    .addItem('Refresh now', 'syncTrainerAttendance')
    .addToUi();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncTrainerAttendance') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncTrainerAttendance')
    .timeBased()
    .everyMinutes(15)
    .create();
}
