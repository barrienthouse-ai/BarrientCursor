/**
 * Read-only inventory of the current workbook.
 * Does not modify sheets, triggers, or scripts.
 */
function SLM_auditWorkbook() {
  var ss = SpreadsheetApp.getActive();
  var sheets = ss.getSheets().map(function (sheet) {
    return sheet.getName();
  });
  var reserved = SLM_reservedSheetNames();
  var existingSlm = sheets.filter(function (name) {
    return reserved.indexOf(name) !== -1;
  });
  var otherSheets = sheets.filter(function (name) {
    return reserved.indexOf(name) === -1;
  });
  var triggers = ScriptApp.getProjectTriggers().map(function (trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      ownedBySlm: trigger.getHandlerFunction().indexOf('SLM_') === 0
    };
  });
  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    reservedSheets: reserved,
    existingSlmSheets: existingSlm,
    otherSheets: otherSheets,
    triggers: triggers,
    safeToInstall: true,
    doNotTouchHits: sheets.filter(function (name) {
      return SLM_DO_NOT_TOUCH.indexOf(name) !== -1;
    }),
    notes: [
      'SLM never defines onOpen, onEdit, doGet, or doPost.',
      'SLM writes only to SLM_* tabs.',
      'DEALINPUT is read-only. SUMMARY, HOME, LOGDEAL, SMR_* service tabs, and AutoCrat are not written.',
      'Add SLM_onOpen(); to your existing onOpen function if you already have a custom menu.'
    ]
  };
}

function SLM_showCompatibilityAudit() {
  var audit = SLM_auditWorkbook();
  var lines = [];
  lines.push(audit.spreadsheetName);
  lines.push('Other sheets left untouched:');
  lines.push(audit.otherSheets.length ? audit.otherSheets.join(', ') : '(none)');
  lines.push('');
  lines.push('SLM sheets present:');
  lines.push(audit.existingSlmSheets.length ? audit.existingSlmSheets.join(', ') : '(none yet — install will create them)');
  lines.push('');
  lines.push(audit.notes.join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}
