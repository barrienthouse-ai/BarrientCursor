/**
 * Read-only helpers against the live Geaux Chevrolet workbook.
 * These functions never write SERVICE BOARD, SVC_RO, or any other existing tab.
 */
function SMR_peekExistingServiceData() {
  var ss = SMR_ss_();
  var board = ss.getSheetByName('SERVICE BOARD');
  var roSheet = ss.getSheetByName('SVC_RO');
  var techs = [];
  if (board) {
    var last = board.getLastRow();
    for (var r = 6; r <= last; r++) {
      var name = String(board.getRange(r, 1).getDisplayValue() || '').trim();
      if (name && name.toUpperCase() !== 'TOTAL') {
        techs.push(name);
      }
    }
  }
  var openCount = 0;
  var closedCount = 0;
  if (roSheet && roSheet.getLastRow() > 1) {
    var statuses = roSheet.getRange(2, 6, roSheet.getLastRow() - 1, 1).getDisplayValues();
    statuses.forEach(function (row) {
      var status = String(row[0] || '').toUpperCase();
      if (status === 'OPEN') {
        openCount += 1;
      } else if (status === 'CLOSED') {
        closedCount += 1;
      }
    });
  }
  return {
    serviceBoardTechs: techs,
    svcRoOpen: openCount,
    svcRoClosed: closedCount,
    wroteToExistingSheets: false
  };
}

function SMR_importRosterFromServiceBoard() {
  SMR_ensureSheets();
  var peek = SMR_peekExistingServiceData();
  var names = peek.serviceBoardTechs;
  if (!names.length) {
    names = SMR_DEFAULT_ROSTER.slice();
  }
  var sheet = SMR_sheet_(SMR_SHEETS.ROSTER);
  SMR_assertWritable_(SMR_SHEETS.ROSTER);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 2).setValues([SMR_HEADERS.ROSTER]);
  var rows = names.map(function (name) {
    return [name, 'Yes'];
  });
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }
  sheet.setFrozenRows(1);
  SMR_rosterStorePut_(names);
  return names;
}

function SMR_showExistingServicePeek() {
  var peek = SMR_peekExistingServiceData();
  SpreadsheetApp.getUi().alert(
    'Read-only peek (no existing tabs were changed)\n\n' +
    'SERVICE BOARD techs:\n' + (peek.serviceBoardTechs.join(', ') || '(none)') + '\n\n' +
    'SVC_RO open: ' + peek.svcRoOpen + '\n' +
    'SVC_RO closed: ' + peek.svcRoClosed + '\n\n' +
    'Use these numbers only as a hint. Daily briefing counts are saved on SMR_RepairOrders.'
  );
}
