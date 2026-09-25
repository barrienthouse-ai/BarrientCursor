/**
 * Spreadsheet menu + one-time setup.
 *
 * Apps Script allows only one onOpen() in the whole project. This file owns it.
 * Delete any other function onOpen() from lease / bonus / report files — keep
 * those tools' other functions.
 *
 * Toolbar: GEAUX TOOLS (lease, bonuses, terminal, SMR, SLM, desk, deal log)
 *          GEAUX REPORTS (deal reports, dealer tool kit, new inventory pricing)
 */

function geauxMenuBlueprint_() {
  return {
    toolsTitle: 'GEAUX TOOLS',
    reportsTitle: 'GEAUX REPORTS',
    tools: [
      {
        title: 'Lease Engine',
        items: [{ label: 'Open Lease Calculator', fn: 'openLeaseCalculator' }]
      },
      {
        title: 'Dealer Bonuses',
        items: [{ label: 'Open Bonus Ladder', fn: 'showDashboard' }]
      },
      {
        title: 'GEAUX Terminal',
        items: [
          { label: 'Open Main Terminal', fn: 'launchMainTerminal' },
          { label: 'Open Finance Terminal', fn: 'launchFinanceTool' }
        ]
      },
      { title: 'Service Manager Report', onOpen: 'SMR_onOpen' },
      { title: 'SLM', onOpen: 'SLM_onOpen' },
      {
        title: 'GEAUX Desk',
        always: true,
        items: [
          { label: 'Open Desking Tool', fn: 'OPEN_DESKING_TOOL' },
          { separator: true },
          { label: 'Create/refresh config sheets', fn: 'ensureConfigSheets' },
          { label: 'Publish quote brochures', fn: 'publishQuoteBrochures' },
          { label: 'Save Web App URL', fn: 'setWebAppUrl' },
          { label: 'Test customer Web App', fn: 'testCustomerWebApp' },
          { label: 'Send test quote email', fn: 'testEmailNotification' }
        ]
      },
      {
        title: 'Deal Log',
        always: true,
        items: [
          { label: 'Open Deal Log Entry', fn: 'OPENLOGDEAL' }
        ]
      }
    ],
    reports: [
      {
        title: 'Deal Reports',
        items: [
          { label: 'Open Deal Comparison Report', fn: 'launchDealComparisonReport' },
          { label: 'Open Trade-In Dashboard', fn: 'launchTradeDashboardFromMenu' },
          { separator: true },
          { label: 'Open Sales Comparison Report', fn: 'SCR_showSalesComparisonReport' }
        ]
      },
      {
        title: 'Dealer Tool Kit',
        items: [
          { label: 'Dealer Trade Entry Form', fn: 'GEAUXDealerForm_OpenBridge' },
          { label: 'Trade-In Dashboard', fn: 'launchTradeDashboardFromMenu' }
        ]
      },
      { title: 'New Inventory Pricing', onOpen: 'NIP_onOpen' }
    ]
  };
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var plan = geauxMenuBlueprint_();
  var tools = ui.createMenu(plan.toolsTitle);
  addGeauxMenuGroups_(ui, tools, plan.tools);
  tools.addToUi();
  var reports = ui.createMenu(plan.reportsTitle);
  if (addGeauxMenuGroups_(ui, reports, plan.reports)) reports.addToUi();
}

function hasFn_(name) {
  try {
    return typeof this[name] === 'function';
  } catch (e) {
    return false;
  }
}

function addGeauxMenuGroups_(ui, parent, groups) {
  var added = 0;
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    if (group.onOpen) {
      if (hasFn_(group.onOpen) && nestOnOpenMenus_(ui, parent, this[group.onOpen], group.title)) added++;
      continue;
    }
    if (addSubMenuIf_(ui, parent, group.title, group.items || [], !!group.always)) added++;
  }
  return added > 0;
}

function addSubMenuIf_(ui, parent, title, items, force) {
  var sub = ui.createMenu(title);
  var count = 0;
  for (var i = 0; i < items.length; i++) {
    if (items[i].separator) {
      if (count) sub.addSeparator();
      continue;
    }
    if (force || hasFn_(items[i].fn)) {
      sub.addItem(items[i].label, items[i].fn);
      count++;
    }
  }
  if (!count) return false;
  parent.addSubMenu(sub);
  return true;
}

function wrapMenuAddToUi_(menu, parent, flag) {
  menu.addToUi = function () {
    parent.addSubMenu(menu);
    flag.nested = true;
    return menu;
  };
  return menu;
}

function wrapUiCreateMenu_(targetUi, parent, flag) {
  var create = targetUi.createMenu.bind(targetUi);
  targetUi.createMenu = function (title) {
    return wrapMenuAddToUi_(create(title), parent, flag);
  };
  return targetUi;
}

function nestOnOpenMenus_(ui, parent, openFn, fallbackTitle) {
  if (typeof openFn !== 'function') return false;
  var origCreate = ui.createMenu;
  var ss = typeof SpreadsheetApp !== 'undefined' ? SpreadsheetApp : null;
  var origGetUi = ss && ss.getUi;
  var flag = { nested: false };
  try {
    wrapUiCreateMenu_(ui, parent, flag);
    if (ss && origGetUi) {
      ss.getUi = function () {
        return wrapUiCreateMenu_(origGetUi.call(ss), parent, flag);
      };
    }
    openFn();
  } catch (e) {
    console.error(e);
  } finally {
    try { ui.createMenu = origCreate; } catch (ignore) {}
    if (ss && origGetUi) {
      try { ss.getUi = origGetUi; } catch (ignore2) {}
    }
  }
  if (flag.nested) return true;
  var fnName = openFn.name || '';
  if (fnName && hasFn_(fnName)) {
    parent.addItem(fallbackTitle || fnName, fnName);
    return true;
  }
  return false;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('NIP_App')
    .setTitle('Geaux Discount Position')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
