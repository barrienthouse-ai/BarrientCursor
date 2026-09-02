/**
 * Menu and install helpers.
 *
 * IMPORTANT: This file does not define onOpen, onEdit, doGet, or doPost.
 * If your workbook already has onOpen, add one line inside it:
 *
 *   SLM_onOpen();
 *
 * If it does not have onOpen, run SLM_install() once. That creates an
 * *installable* trigger pointed at SLM_onOpen, which leaves any future
 * simple onOpen you add later able to coexist.
 */
function SLM_onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(SLM_MENU_NAME)
    .addItem('Open end-of-day recap', 'SLM_openRecap')
    .addItem('Refresh dashboard sheet', 'SLM_refreshDashboard')
    .addItem('Set report email', 'SLM_promptReportEmail')
    .addSeparator()
    .addItem('Install / repair SLM sheets', 'SLM_install')
    .addItem('Peek DEALINPUT retail totals', 'SLM_showDealLogPeek')
    .addItem('Compatibility audit', 'SLM_showCompatibilityAudit')
    .addToUi();
}

function SLM_install() {
  SLM_ensureSheets();
  SLM_refreshDashboard();
  SLM_ensureOpenTrigger_();
  SpreadsheetApp.getUi().alert(
    'Sales Manager Report is installed.\n\n' +
    'Created or reused only SLM_* tabs. Existing sheets (including DEALINPUT, SUMMARY, and SMR_*) were not renamed or deleted.\n\n' +
    'If you already have an onOpen function, add this line to it:\nSLM_onOpen();'
  );
}

function SLM_openRecap() {
  var template = HtmlService.createTemplateFromFile('SLM_App');
  var today = SLM_todayKey_();
  template.seedJson = SLM_safeJson_({
    date: today,
    nextBusinessDate: SLM_nextBusinessDay_(today),
    saved: false,
    fromDealLog: false,
    loading: true,
    report: SLM_normalizeReport_({ date: today }),
    dealLog: {
      date: today,
      daily: SLM_emptyTotals_(),
      lastRetailDate: '',
      available: true
    }
  });
  var html = template.evaluate()
    .setWidth(1400)
    .setHeight(900)
    .setTitle('Sales Manager Report');
  SpreadsheetApp.getUi().showModalDialog(html, 'Sales Manager Report');
}

function SLM_ensureOpenTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'SLM_onOpen') {
      return;
    }
  }
  ScriptApp.newTrigger('SLM_onOpen').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
}
