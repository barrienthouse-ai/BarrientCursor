/**
 * Read-only inventory of the current workbook.
 * Does not modify sheets, triggers, or scripts.
 */
function SMR_auditWorkbook() {
  var ss = SpreadsheetApp.getActive();
  var sheets = ss.getSheets().map(function (sheet) {
    return sheet.getName();
  });
  var reserved = SMR_reservedSheetNames();
  var existingSmr = sheets.filter(function (name) {
    return reserved.indexOf(name) !== -1;
  });
  var otherSheets = sheets.filter(function (name) {
    return reserved.indexOf(name) === -1;
  });
  var triggers = ScriptApp.getProjectTriggers().map(function (trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      ownedBySmr: trigger.getHandlerFunction().indexOf('SMR_') === 0
    };
  });
  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    reservedSheets: reserved,
    existingSmrSheets: existingSmr,
    otherSheets: otherSheets,
    triggers: triggers,
    safeToInstall: true,
    doNotTouchHits: sheets.filter(function (name) {
      return SMR_DO_NOT_TOUCH.indexOf(name) !== -1;
    }),
    notes: [
      'SMR never defines onOpen, onEdit, doGet, or doPost.',
      'SMR writes only to SMR_* tabs.',
      'SERVICE BOARD, SVC_RO, SVC_RO_LINES, SUMMARY, HOME, and the other live Geaux tabs are read-only to SMR.',
      'Add SMR_onOpen(); to your existing onOpen function if you already have a custom menu.'
    ]
  };
}

function SMR_showCompatibilityAudit() {
  var audit = SMR_auditWorkbook();
  var lines = [];
  lines.push(audit.spreadsheetName);
  lines.push('Other sheets left untouched:');
  lines.push(audit.otherSheets.length ? audit.otherSheets.join(', ') : '(none)');
  lines.push('');
  lines.push('SMR sheets present:');
  lines.push(audit.existingSmrSheets.length ? audit.existingSmrSheets.join(', ') : '(none yet — install will create them)');
  lines.push('');
  lines.push(audit.notes.join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}
