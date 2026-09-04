/**
 * Menu and install helpers.
 *
 * IMPORTANT: This file does not define onOpen, onEdit, doGet, or doPost.
 * If your workbook already has onOpen, add one line inside it:
 *
 *   FLM_onOpen();
 *
 * If it does not have onOpen, run FLM_install() once. That creates an
 * *installable* trigger pointed at FLM_onOpen, which leaves any future
 * simple onOpen you add later able to coexist.
 */
function FLM_onOpen() {
  if (!FLM_hasBoundSpreadsheet_()) {
    return;
  }
  SpreadsheetApp.getUi()
    .createMenu(FLM_MENU_NAME)
    .addItem('Open briefing', 'FLM_openBriefing')
    .addItem('Refresh dashboard sheet', 'FLM_refreshDashboard')
    .addSeparator()
    .addItem('Install / repair FLM sheets', 'FLM_install')
    .addItem('Peek DEALINPUT fleet totals', 'FLM_showDealLogPeek')
    .addItem('Compatibility audit', 'FLM_showCompatibilityAudit')
    .addToUi();
}

function FLM_install() {
  FLM_ensureSheets();
  FLM_refreshDashboard();
  if (!FLM_hasBoundSpreadsheet_()) {
    return FLM_ss_().getName();
  }
  FLM_ensureOpenTrigger_();
  SpreadsheetApp.getUi().alert(
    'Fleet Manager Report is installed.\n\n' +
    'Created or reused only FLM_* tabs. Existing sheets (including DEALINPUT, FLEET CUSTOMERS, SMR_*, and SLM_*) were not renamed or deleted.\n\n' +
    'If you already have an onOpen function, add this line to it:\nFLM_onOpen();'
  );
}

function FLM_briefingHtml_() {
  var template = HtmlService.createTemplateFromFile('FLM_App');
  var stored = FLM_briefStoreGet_(FLM_todayKey_());
  template.seedJson = stored && stored.summary ? FLM_safeJson_(stored) : 'null';
  return template.evaluate().setTitle('Fleet Manager Report');
}

function FLM_openBriefing() {
  var html = FLM_briefingHtml_().setWidth(1280).setHeight(880);
  SpreadsheetApp.getUi().showModalDialog(html, 'Fleet Manager Report');
}

function FLM_ensureOpenTrigger_() {
  if (!FLM_hasBoundSpreadsheet_()) {
    return;
  }
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'FLM_onOpen') {
      return;
    }
  }
  ScriptApp.newTrigger('FLM_onOpen').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
}
