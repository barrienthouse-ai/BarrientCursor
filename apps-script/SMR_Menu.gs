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
  SpreadsheetApp.getUi()
    .createMenu(SMR_MENU_NAME)
    .addItem('Open briefing', 'SMR_openBriefing')
    .addItem('Refresh dashboard sheet', 'SMR_refreshDashboard')
    .addSeparator()
    .addItem('Install / repair SMR sheets', 'SMR_install')
    .addItem('Compatibility audit', 'SMR_showCompatibilityAudit')
    .addToUi();
}

function SMR_install() {
  SMR_ensureSheets();
  SMR_refreshDashboard();
  SMR_ensureOpenTrigger_();
  SpreadsheetApp.getUi().alert(
    'Service Manager Report is installed.\n\n' +
    'Created or reused only SMR_* tabs. Existing sheets were not renamed or deleted.\n\n' +
    'If you already have an onOpen function, add this line to it:\nSMR_onOpen();'
  );
}

function SMR_openBriefing() {
  var html = HtmlService.createHtmlOutputFromFile('SMR_App')
    .setWidth(1100)
    .setHeight(740)
    .setTitle('Service Manager Report');
  SpreadsheetApp.getUi().showModalDialog(html, 'Service Manager Report');
}

function SMR_ensureOpenTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'SMR_onOpen') {
      return;
    }
  }
  ScriptApp.newTrigger('SMR_onOpen').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
}
