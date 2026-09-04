/**
 * Menu and install helpers.
 *
 * IMPORTANT: This file does not define onOpen, onEdit, doGet, or doPost.
 * If your workbook already has onOpen, add one line inside it:
 *
 *   SMR_onOpen();
 *
 * If it does not have onOpen, run SMR_install() once. That creates an
 * *installable* trigger pointed at SMR_onOpen, which leaves any future
 * simple onOpen you add later able to coexist.
 */
function SMR_onOpen() {
  if (!SMR_hasBoundSpreadsheet_()) {
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
  var stored = SMR_briefStoreGet_(SMR_todayKey_());
  template.seedJson = stored && stored.summary ? SMR_safeJson_(stored) : 'null';
  return template.evaluate().setTitle('Service Manager Report');
}

function SMR_openBriefing() {
  var html = SMR_briefingHtml_().setWidth(1240).setHeight(860);
  SpreadsheetApp.getUi().showModalDialog(html, 'Service Manager Report');
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
