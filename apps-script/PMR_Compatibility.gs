/**
 * Read-only inventory of the current workbook.
 * Does not modify sheets, triggers, or scripts.
 */
function PMR_auditWorkbook() {
  var ss = PMR_ss_();
  var sheets = ss.getSheets().map(function (sheet) {
    return sheet.getName();
  });
  var reserved = PMR_reservedSheetNames();
  var existingPmr = sheets.filter(function (name) {
    return reserved.indexOf(name) !== -1;
  });
  var otherSheets = sheets.filter(function (name) {
    return reserved.indexOf(name) === -1;
  });
  var triggers = ScriptApp.getProjectTriggers().map(function (trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      ownedByPmr: trigger.getHandlerFunction().indexOf('PMR_') === 0
    };
  });
  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    reservedSheets: reserved,
    existingPmrSheets: existingPmr,
    otherSheets: otherSheets,
    triggers: triggers,
    safeToInstall: true,
    doNotTouchHits: sheets.filter(function (name) {
      return PMR_DO_NOT_TOUCH.indexOf(name) !== -1;
    }),
    notes: [
      'PMR never defines onOpen, onEdit, doGet, or doPost.',
      'PMR writes only to PMR_* tabs.',
      'PARTS_ITEMS, PARTS_TICKETS, SVC_PARTS_REQUESTS, SLM_*, SMR_*, FLM_*, SUMMARY, and HOME are read-only to PMR.',
      'Add PMR_onOpen(); to your existing onOpen function if you already have a custom menu.'
    ]
  };
}

function PMR_showCompatibilityAudit() {
  var audit = PMR_auditWorkbook();
  var lines = [];
  lines.push(audit.spreadsheetName);
  lines.push('Other sheets left untouched:');
  lines.push(audit.otherSheets.length ? audit.otherSheets.join(', ') : '(none)');
  lines.push('');
  lines.push('PMR sheets present:');
  lines.push(audit.existingPmrSheets.length ? audit.existingPmrSheets.join(', ') : '(none yet — install will create them)');
  lines.push('');
  lines.push(audit.notes.join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}
