/**
 * Spreadsheet menu + one-time setup.
 *
 * Apps Script allows only one onOpen() in the whole project. This file owns it
 * so GEAUX Desk and the existing dealer menus (Lease Engine, bonuses, reports,
 * tool kit, terminal) all appear. Delete any other function onOpen() from the
 * lease / bonus / report files — keep those tools' other functions.
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('GEAUX Desk')
    .addItem('Open Desking Tool', 'OPEN_DESKING_TOOL')
    .addSeparator()
    .addItem('Create/refresh config sheets', 'ensureConfigSheets')
    .addItem('Publish quote brochures', 'publishQuoteBrochures')
    .addItem('Save Web App URL', 'setWebAppUrl')
    .addItem('Test customer Web App', 'testCustomerWebApp')
    .addItem('Send test quote email', 'testEmailNotification')
    .addToUi();
  addExistingDealerMenus_(ui);
}

function addExistingDealerMenus_(ui) {
  if (typeof openLeaseCalculator === 'function') {
    ui.createMenu('Lease Engine')
      .addItem('Open Lease Calculator', 'openLeaseCalculator')
      .addToUi();
  }
  if (typeof showDashboard === 'function') {
    ui.createMenu('Dealer Bonuses')
      .addItem('Open Bonus Ladder', 'showDashboard')
      .addToUi();
  }
  if (typeof launchDealComparisonReport === 'function' ||
      typeof launchTradeDashboardFromMenu === 'function' ||
      typeof SCR_showSalesComparisonReport === 'function') {
    var reports = ui.createMenu('Deal Reports');
    if (typeof launchDealComparisonReport === 'function') {
      reports.addItem('Open Deal Comparison Report', 'launchDealComparisonReport');
    }
    if (typeof launchTradeDashboardFromMenu === 'function') {
      reports.addItem('Open Trade-In Dashboard', 'launchTradeDashboardFromMenu');
    }
    if (typeof SCR_showSalesComparisonReport === 'function') {
      reports.addSeparator();
      reports.addItem('Open Sales Comparison Report', 'SCR_showSalesComparisonReport');
    }
    reports.addToUi();
  }
  if (typeof GEAUXDealerForm_OpenBridge === 'function' ||
      typeof launchTradeDashboardFromMenu === 'function') {
    var toolkit = ui.createMenu('Dealer Tool Kit');
    if (typeof GEAUXDealerForm_OpenBridge === 'function') {
      toolkit.addItem('Dealer Trade Entry Form', 'GEAUXDealerForm_OpenBridge');
    }
    if (typeof launchTradeDashboardFromMenu === 'function') {
      toolkit.addItem('Trade-In Dashboard', 'launchTradeDashboardFromMenu');
    }
    toolkit.addToUi();
  }
  if (typeof launchMainTerminal === 'function' || typeof launchFinanceTool === 'function') {
    var terminal = ui.createMenu('GEAUX Terminal');
    if (typeof launchMainTerminal === 'function') {
      terminal.addItem('Open Main Terminal', 'launchMainTerminal');
    }
    if (typeof launchFinanceTool === 'function') {
      terminal.addItem('Open Finance Terminal', 'launchFinanceTool');
    }
    terminal.addToUi();
  }
  if (typeof SMR_onOpen === 'function') SMR_onOpen();
  if (typeof SLM_onOpen === 'function') SLM_onOpen();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
