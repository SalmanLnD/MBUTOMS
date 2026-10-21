/**
 * MBU TOMS Trainer Attendance sync — Extensions → Apps Script
 * Run installTriggers() once after pasting this script.
 */
const EXPORT_URL = '__EXPORT_URL__';
const RTET_EXPORT_URL = '__RTET_EXPORT_URL__';
const API_KEY = '__API_KEY__';
const DEFAULT_SHEET_NAME = 'Trainer Attendance from July 13';
const RTET_SHEET_NAME = 'rtet';

function wakeTomsApi() {
  try {
    var healthUrl = String(EXPORT_URL || '').replace(/\/api\/attendance\/export.*$/, '/api/health');
    if (healthUrl.indexOf('/api/health') === -1) return;
    UrlFetchApp.fetch(healthUrl, { muteHttpExceptions: true });
  } catch (error) {}
}

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
    if (body.indexOf('Just a moment') !== -1) {
      throw new Error(
        'TOMS API error (' + code + '): Cloudflare blocked the sheet sync. '
        + 'Wait one minute, then use Refresh now. Do not run installTriggers again.'
      );
    }
    if (code === 429 || code === 502 || code === 503 || code === 504) {
      continue;
    }
    throw new Error(lastMessage);
  }

  throw new Error(
    lastMessage + ' The API may be busy. Wait 30 seconds and use Refresh now once.'
  );
}

function syncTrainerAttendance() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    return syncTrainerAttendanceUnlocked();
  } finally {
    lock.releaseLock();
  }
}

function syncTrainerAttendanceUnlocked() {
  wakeTomsApi();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var failures = [];
  try {
    syncRTET(spreadsheet);
    SpreadsheetApp.flush();
  } catch (error) {
    failures.push('RTET: ' + error.message);
  }
  try {
    syncAttendanceSheet();
    SpreadsheetApp.flush();
  } catch (error) {
    failures.push('Attendance: ' + error.message);
  }
  if (failures.length) throw new Error(failures.join('\n'));
}

function syncRTETOnly() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    syncRTET(SpreadsheetApp.getActiveSpreadsheet());
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function syncAttendanceSheet() {
  var payload = fetchTomsJson(EXPORT_URL + (EXPORT_URL.indexOf('?') === -1 ? '?' : '&') + 'syncVersion=2');
  var rows = payload.rows || [];
  if (payload.syncVersion !== 2 || rows.length < 2) throw new Error('Attendance payload is incomplete; existing rows were preserved.');
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = payload.sheetName || DEFAULT_SHEET_NAME;
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  var restored = [];
  if (payload.syncVersion >= 2 && rows.length >= 2) {
    var migration = prepareAttendanceMoves(spreadsheet, sheet, payload);
    rows = migration.rows;
    restored = migration.restored;
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
  // Delete restored Exit snapshots only after the active sheet write succeeded.
  if (restored.length) {
    SpreadsheetApp.flush();
    var exit = spreadsheet.getSheetByName('Exit');
    restored.sort(function(a, b) { return b - a; }).forEach(function(row) { exit.deleteRows(row - 2, 3); });
  }
}

function attendanceDateKey(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Kolkata', 'yyyy-MM-dd');
  var text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  var parts = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (parts) {
    var month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(parts[2].toLowerCase()) + 1;
    if (month) return parts[3] + '-' + ('0' + month).slice(-2) + '-' + ('0' + parts[1]).slice(-2);
  }
  var date = new Date(text);
  return isNaN(date.getTime()) ? '' : Utilities.formatDate(date, 'Asia/Kolkata', 'yyyy-MM-dd');
}

function mergeAttendanceHistory(rows, snapshots, authoritative, today) {
  var merged = rows.map(function(row) { return row.slice(); });
  var targets = {};
  merged.slice(2).forEach(function(row) { targets[String(row[1])] = row; });
  var columns = {};
  var currentDate = '';
  for (var c = 2; c < merged[0].length; c++) {
    currentDate = attendanceDateKey(merged[0][c]) || currentDate;
    columns[currentDate + '|' + merged[1][c]] = c;
  }
  var saved = {};
  (authoritative || []).forEach(function(row) { saved[row.employeeId + '|' + row.date] = true; });
  snapshots.forEach(function(snapshot) {
    var id = String(snapshot.row[1]);
    var target = targets[id];
    if (!target) return;
    var date = '';
    for (var c = 2; c < snapshot.row.length; c++) {
      date = attendanceDateKey(snapshot.headers[0][c]) || date;
      if (!date || !snapshot.headers[1][c]) continue;
      var token = date + '|' + snapshot.headers[1][c];
      var column = columns[token];
      if (column === undefined) {
        column = merged[0].length;
        columns[token] = column;
        merged[0].push(date);
        merged[1].push(snapshot.headers[1][c]);
      }
      if (date < today && !saved[id + '|' + date]) target[column] = snapshot.row[c];
    }
  });
  return merged;
}

function prepareAttendanceMoves(spreadsheet, sheet, payload) {
  var active = {};
  payload.rows.slice(2).forEach(function(row) { active[String(row[1])] = true; });
  var inactive = {};
  (payload.inactiveEmployeeIds || []).forEach(function(id) { inactive[String(id)] = true; });
  var snapshots = [], restoredSnapshots = [], restored = [], archived = {};
  var exit = spreadsheet.getSheetByName('Exit');
  if (!exit) exit = spreadsheet.insertSheet('Exit');
  var exitLast = exit.getLastRow();
  if (exitLast) {
    var notes = exit.getRange(1, 1, exitLast, 1).getNotes();
    notes.forEach(function(note, index) {
      var prefix = 'TOMS_ATTENDANCE_ARCHIVE:';
      if (String(note[0]).indexOf(prefix) !== 0) return;
      var id = String(note[0]).slice(prefix.length);
      archived[id] = true;
      if (!active[id] || index < 2) return;
      var block = exit.getRange(index - 1, 1, 3, exit.getLastColumn()).getValues();
      restoredSnapshots.push({ headers: block.slice(0, 2), row: block[2] });
      restored.push(index + 1);
    });
  }
  var last = sheet.getLastRow();
  var width = sheet.getLastColumn();
  if (last >= 3 && width >= 2) {
    var values = sheet.getRange(1, 1, last, width).getValues();
    values.slice(2).forEach(function(row, index) {
      var id = String(row[1]);
      if (active[id]) snapshots.push({ headers: values.slice(0, 2), row: row });
      else if (/^\d+$/.test(id) && !archived[id]) {
        var destination = exit.getLastRow() + 2;
        if (exit.getMaxColumns() < width) exit.insertColumnsAfter(exit.getMaxColumns(), width - exit.getMaxColumns());
        if (exit.getMaxRows() < destination + 2) exit.insertRowsAfter(exit.getMaxRows(), destination + 2 - exit.getMaxRows());
        sheet.getRange(1, 1, 2, width).copyTo(exit.getRange(destination, 1, 2, width));
        sheet.getRange(index + 3, 1, 1, width).copyTo(exit.getRange(destination + 2, 1, 1, width));
        exit.getRange(destination + 2, 1).setNote('TOMS_ATTENDANCE_ARCHIVE:' + id);
        archived[id] = true;
      }
    });
  }
  SpreadsheetApp.flush();
  return { rows: mergeAttendanceHistory(payload.rows, snapshots.concat(restoredSnapshots), payload.authoritativeDates,
    Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd')), restored: restored };
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
    var failedSheet = spreadsheet.getSheetByName(RTET_SHEET_NAME);
    if (!failedSheet) failedSheet = spreadsheet.insertSheet(RTET_SHEET_NAME);
    var message = 'Last RTET sync failed: ' + e.message;
    failedSheet.getRange(1, 1).setNote(message);
    Logger.log(message);
    throw e;
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

  // Keep column A empty so relative formulas that shifted to column C continue
  // to point at the first RTET date (12 Jul 2026).
  var firstOutputColumn = 2;
  var requiredColumns = numCols + firstOutputColumn - 1;

  // Resize sheet to fit.
  if (rtetSheet.getMaxColumns() < requiredColumns) {
    rtetSheet.insertColumnsAfter(
      rtetSheet.getMaxColumns(),
      requiredColumns - rtetSheet.getMaxColumns()
    );
  }
  if (rtetSheet.getMaxRows() < numRows) {
    rtetSheet.insertRowsAfter(rtetSheet.getMaxRows(), numRows - rtetSheet.getMaxRows());
  }

  rtetSheet.clear();
  rtetSheet.getRange(1, 1).clearNote();
  rtetSheet.getRange(1, firstOutputColumn, numRows, numCols).setValues(out);

  // Freeze header row, the empty spacer column, and Subject column.
  rtetSheet.setFrozenRows(1);
  rtetSheet.setFrozenColumns(2);

  // Styling.
  var allRange = rtetSheet.getRange(1, firstOutputColumn, numRows, numCols);
  allRange
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(false)
    .setBorder(true, true, true, true, true, true);

  // Header row styling.
  rtetSheet.getRange(1, firstOutputColumn, 1, numCols)
    .setFontWeight('bold')
    .setBackground('#cfe2f3');

  // Subject name column — left-align and bold.
  rtetSheet.getRange(1, firstOutputColumn, numRows, 1)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');

  // Totals row (last row) styling.
  rtetSheet.getRange(numRows, firstOutputColumn, 1, numCols)
    .setFontWeight('bold')
    .setBackground('#fff2cc');

  // Grand total cell styling.
  rtetSheet.getRange(numRows, requiredColumns)
    .setBackground('#f9cb9c');

  // Column widths.
  rtetSheet.setColumnWidth(firstOutputColumn, 280);
  if (numCols > 1) {
    rtetSheet.setColumnWidths(firstOutputColumn + 1, numCols - 1, 110);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TOMS Attendance')
    .addItem('Refresh now', 'syncTrainerAttendance')
    .addItem('Refresh RTET now', 'syncRTETOnly')
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
