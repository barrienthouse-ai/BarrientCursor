/**
 * Read-only inventory of the current workbook.
 * Does not modify sheets, triggers, or scripts.
 */
function FLM_auditWorkbook() {
  var ss = FLM_ss_();
  var sheets = ss.getSheets().map(function (sheet) {
    return sheet.getName();
  });
  var reserved = FLM_reservedSheetNames();
  var existingFlm = sheets.filter(function (name) {
    return reserved.indexOf(name) !== -1;
  });
  var otherSheets = sheets.filter(function (name) {
    return reserved.indexOf(name) === -1;
  });
  var triggers = ScriptApp.getProjectTriggers().map(function (trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      ownedByFlm: trigger.getHandlerFunction().indexOf('FLM_') === 0
    };
  });
  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    reservedSheets: reserved,
    existingFlmSheets: existingFlm,
    otherSheets: otherSheets,
    triggers: triggers,
    safeToInstall: true,
    doNotTouchHits: sheets.filter(function (name) {
      return FLM_DO_NOT_TOUCH.indexOf(name) !== -1;
    }),
    notes: [
      'FLM never defines onOpen, onEdit, doGet, or doPost in the bound workbook package.',
      'FLM writes only to FLM_* tabs.',
      'DEALINPUT is read-only for a fleet totals hint. FLEET CUSTOMERS, SUMMARY, HOME, SMR_*, and SLM_* are not written.',
      'Add FLM_onOpen(); to your existing onOpen function if you already have a custom menu.'
    ]
  };
}

function FLM_showCompatibilityAudit() {
  var audit = FLM_auditWorkbook();
  var lines = [];
  lines.push(audit.spreadsheetName);
  lines.push('Other sheets left untouched:');
  lines.push(audit.otherSheets.length ? audit.otherSheets.join(', ') : '(none)');
  lines.push('');
  lines.push('FLM sheets present:');
  lines.push(audit.existingFlmSheets.length ? audit.existingFlmSheets.join(', ') : '(none yet — install will create them)');
  lines.push('');
  lines.push(audit.notes.join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}
