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
  SMR_upgradeTechHoursHeader_(ss.getSheetByName(SMR_SHEETS.TECH_HOURS));
  SMR_ensureSheet_(ss, SMR_SHEETS.GROSS, SMR_HEADERS.GROSS, []);
  SMR_ensureSheet_(ss, SMR_SHEETS.HEAT, SMR_HEADERS.HEAT, []);
  SMR_ensureSheet_(ss, SMR_SHEETS.ROS, SMR_HEADERS.ROS, []);
  SMR_ensureDashboard_(ss);
  return SMR_reservedSheetNames();
}

function SMR_assertWritable_(name) {
  if (SMR_DO_NOT_TOUCH.indexOf(name) !== -1 || !SMR_isSmrSheetName_(name)) {
    throw new Error('SMR refused to write to "' + name + '". Only SMR_* tabs are writable.');
  }
}

function SMR_ensureSheet_(ss, name, headers, seedRows) {
  SMR_assertWritable_(name);
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
  SMR_assertWritable_(SMR_SHEETS.DASHBOARD);
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

function SMR_upgradeTechHoursHeader_(sheet) {
  if (!sheet) {
    return;
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  if (headers.indexOf('Open ROs') !== -1) {
    return;
  }
  if (headers[0] === 'Date' && headers[4] === 'Notes') {
    sheet.insertColumnsAfter(4, 3);
    sheet.getRange(1, 5, 1, 3).setValues([['Open ROs', 'Closed today', 'Written today']]);
    return;
  }
  sheet.getRange(1, 1, 1, SMR_HEADERS.TECH_HOURS.length).setValues([SMR_HEADERS.TECH_HOURS]);
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
        var padded = values[i].slice();
        while (padded.length < headers.length) {
          padded.push('');
        }
        kept.push(padded.slice(0, headers.length));
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
