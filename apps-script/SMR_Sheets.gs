/**
 * Creates only missing SMR_* tabs. Never deletes, hides, or renames
 * any existing sheet — including leftover SMR sheets from a prior install.
 */
function SMR_ensureSheets() {
  var ss = SpreadsheetApp.getActive();
  SMR_ensureSheet_(ss, SMR_SHEETS.CONFIG, SMR_HEADERS.CONFIG, [['Timezone', Session.getScriptTimeZone()], ['Submitter', 'Service Manager']]);
  SMR_ensureSheet_(ss, SMR_SHEETS.ROSTER, SMR_HEADERS.ROSTER, SMR_DEFAULT_ROSTER.map(function (name) {
    return [name, 'Yes'];
  }));
  SMR_ensureSheet_(ss, SMR_SHEETS.TECH_HOURS, SMR_HEADERS.TECH_HOURS, []);
  SMR_ensureSheet_(ss, SMR_SHEETS.GROSS, SMR_HEADERS.GROSS, []);
  SMR_ensureSheet_(ss, SMR_SHEETS.HEAT, SMR_HEADERS.HEAT, []);
  SMR_ensureSheet_(ss, SMR_SHEETS.ROS, SMR_HEADERS.ROS, []);
  SMR_ensureDashboard_(ss);
  return SMR_reservedSheetNames();
}

function SMR_ensureSheet_(ss, name, headers, seedRows) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    if (seedRows && seedRows.length) {
      sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    }
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function SMR_ensureDashboard_(ss) {
  var sheet = ss.getSheetByName(SMR_SHEETS.DASHBOARD);
  if (!sheet) {
    sheet = ss.insertSheet(SMR_SHEETS.DASHBOARD);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1').setValue('Service Manager Report');
    sheet.getRange('A2').setValue('Use the Service Manager Report menu to refresh this briefing. Other workbook tabs are not modified.');
  }
  return sheet;
}

function SMR_sheet_(name) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) {
    SMR_ensureSheets();
    sheet = SpreadsheetApp.getActive().getSheetByName(name);
  }
  return sheet;
}

function SMR_readObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      row[headers[c]] = values[i][c];
      if (values[i][c] !== '' && values[i][c] !== null) {
        empty = false;
      }
    }
    if (!empty) {
      rows.push(row);
    }
  }
  return rows;
}

function SMR_replaceDateRows_(sheet, dateColumnName, dateKey, newRows, headers) {
  var values = sheet.getDataRange().getValues();
  var kept = [headers];
  if (values.length) {
    var header = values[0];
    var dateIdx = header.indexOf(dateColumnName);
    for (var i = 1; i < values.length; i++) {
      var existingDate = SMR_toDateKey_(values[i][dateIdx]);
      if (existingDate !== dateKey) {
        kept.push(values[i]);
      }
    }
  }
  newRows.forEach(function (row) {
    kept.push(row);
  });
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, headers.length).setValues(kept);
  sheet.setFrozenRows(1);
}
