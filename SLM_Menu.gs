/**
 * Menu and install helpers.
 *
 * IMPORTANT: This file does not define onOpen, onEdit, doGet, or doPost.
 * If your workbook already has onOpen, add one line inside it:
 *
 *   SLM_onOpen();
 *
 * Code.gs already calls SLM_onOpen() from the single project onOpen().
 * Do not add another onOpen() here. Do not install a second onOpen trigger.
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
  SLM_dedupeDailySheet_();
  SLM_refreshDashboard();
  SpreadsheetApp.getUi().alert(
    'Sales Manager Report is installed.\n\n' +
    'Created or reused only SLM_* tabs. Existing sheets (including DEALINPUT, SUMMARY, and SMR_*) were not renamed or deleted.\n\n' +
    'Each calendar day can have only one recap. Saving the same date overwrites that row and recalculates totals.\n\n' +
    'Reload the spreadsheet. Open it from GEAUX TOOLS → Sales Manager Report → Open end-of-day recap.'
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
  return;
}
