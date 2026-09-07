/**
 * Menu and install helpers.
 *
 * IMPORTANT: This file does not define onOpen, onEdit, doGet, or doPost.
 * Never paste this file over Code.gs or any existing tool file.
 * If your workbook already has onOpen, add this at the END of it:
 *
 *   try { PMR_onOpen(); } catch (ignore) {}
 */
function PMR_onOpen() {
  try {
    if (typeof PMR_hasBoundSpreadsheet_ === 'function' && !PMR_hasBoundSpreadsheet_()) {
      return;
    }
    SpreadsheetApp.getUi()
      .createMenu(PMR_MENU_NAME)
      .addItem('Open briefing', 'PMR_openBriefing')
      .addItem('Refresh dashboard sheet', 'PMR_refreshDashboard')
      .addItem('Email GM recap', 'PMR_emailToday')
      .addSeparator()
      .addItem('Set report email', 'PMR_promptReportEmail')
      .addItem('Install / repair PMR sheets', 'PMR_install')
      .addItem('Peek existing PARTS tabs', 'PMR_showExistingPartsPeek')
      .addItem('Compatibility audit', 'PMR_showCompatibilityAudit')
      .addToUi();
  } catch (ignore) {}
}

function PMR_install() {
  PMR_ensureSheets();
  PMR_refreshDashboard();
  if (!PMR_hasBoundSpreadsheet_()) {
    return PMR_ss_().getName();
  }
  PMR_ensureOpenTrigger_();
  SpreadsheetApp.getUi().alert(
    'Parts Manager Report is installed.\n\n' +
    'Created or reused only PMR_* tabs. Existing sheets were not renamed or deleted.\n\n' +
    'If you already have an onOpen function, add this line to it:\nPMR_onOpen();'
  );
}

function PMR_briefingHtml_() {
  return HtmlService.createHtmlOutputFromFile('PMR_App').setTitle('Parts Manager Report');
}

function PMR_openBriefing() {
  try {
    var html = PMR_briefingHtml_().setWidth(1240).setHeight(860);
    SpreadsheetApp.getUi().showModalDialog(html, 'Parts Manager Report');
  } catch (err) {
    SpreadsheetApp.getUi().alert('Parts Manager Report could not open: ' + (err.message || err));
  }
}

function PMR_ensureOpenTrigger_() {
  if (!PMR_hasBoundSpreadsheet_()) {
    return;
  }
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'PMR_onOpen') {
      return;
    }
  }
  ScriptApp.newTrigger('PMR_onOpen').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
}
