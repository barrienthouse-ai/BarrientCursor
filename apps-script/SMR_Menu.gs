/**
 * Menu and install helpers.
 *
 * IMPORTANT: This file does not define onOpen, onEdit, doGet, or doPost.
 * Never paste this file over Code.gs or any existing tool file.
 * If your workbook already has onOpen, add this at the END of it:
 *
 *   try { SMR_onOpen(); } catch (ignore) {}
 *
 * If it does not have onOpen, run SMR_install() once. That creates an
 * *installable* trigger pointed at SMR_onOpen, which leaves any future
 * simple onOpen you add later able to coexist.
 */
function SMR_onOpen() {
  try {
    if (typeof SMR_hasBoundSpreadsheet_ === 'function' && !SMR_hasBoundSpreadsheet_()) {
      return;
    }
    SpreadsheetApp.getUi()
      .createMenu(SMR_MENU_NAME)
      .addItem('Open briefing', 'SMR_openBriefing')
      .addItem('Refresh dashboard sheet', 'SMR_refreshDashboard')
      .addSeparator()
      .addItem('Install / repair SMR sheets', 'SMR_install')
      .addItem('Import roster from SERVICE BOARD', 'SMR_importRosterFromServiceBoard')
      .addItem('Peek existing SVC_RO counts', 'SMR_showExistingServicePeek')
      .addItem('Compatibility audit', 'SMR_showCompatibilityAudit')
      .addToUi();
  } catch (ignore) {}
}

function SMR_install() {
  SMR_ensureSheets();
  SMR_refreshDashboard();
  if (!SMR_hasBoundSpreadsheet_()) {
    return SMR_ss_().getName();
  }
  SMR_ensureOpenTrigger_();
  SpreadsheetApp.getUi().alert(
    'Service Manager Report is installed.\n\n' +
    'Created or reused only SMR_* tabs. Existing sheets were not renamed or deleted.\n\n' +
    'If you already have an onOpen function, add this line to it:\nSMR_onOpen();'
  );
}

function SMR_briefingHtml_() {
  var template = HtmlService.createTemplateFromFile('SMR_App');
  var seedJson = 'null';
  try {
    if (typeof SMR_briefStoreGet_ === 'function') {
      var stored = SMR_briefStoreGet_(SMR_todayKey_());
      if (stored && stored.summary) {
        seedJson = SMR_safeJson_(stored);
      }
    }
  } catch (ignore) {}
  template.seedJson = seedJson;
  return template.evaluate().setTitle('Service Manager Report');
}

function SMR_openBriefing() {
  try {
    var html = SMR_briefingHtml_().setWidth(1240).setHeight(860);
    SpreadsheetApp.getUi().showModalDialog(html, 'Service Manager Report');
  } catch (err) {
    SpreadsheetApp.getUi().alert('Service Manager Report could not open: ' + (err.message || err));
  }
}

function SMR_ensureOpenTrigger_() {
  if (!SMR_hasBoundSpreadsheet_()) {
    return;
  }
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'SMR_onOpen') {
      return;
    }
  }
  ScriptApp.newTrigger('SMR_onOpen').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
}
