/**
 * Parts Manager Report — isolated configuration.
 * Every identifier in this project is prefixed with PMR_ so it cannot
 * overwrite functions, menus, triggers, or properties used by other tools.
 */
var PMR_SHEETS = {
  DASHBOARD: 'PMR_Dashboard',
  DAILY: 'PMR_Daily',
  LOST: 'PMR_LostSales',
  SOP: 'PMR_Sop',
  BACKORDERS: 'PMR_Backorders',
  CORES: 'PMR_Cores',
  CONFIG: 'PMR_Config'
};

var PMR_HEADERS = {
  DAILY: [
    'Date', 'Inventory $', 'Capital limit $', 'Payables $', 'N3M $', 'N6M $', 'Overstock $',
    'Retail sales $', 'Wholesale sales $', 'Internal sales $', 'Counter wait min',
    'Lost sales count', 'Lost sales $', 'SOP received', 'SOP aged 14+', 'SOP aged $',
    'RIM %', 'RIM target %', 'Emergency / CSO', 'Freight $', 'Cores $',
    'Wholesale stops', 'Hot-shots', 'Fuel $', 'Notes', 'Submitted by', 'Submitted at'
  ],
  LOST: ['Item ID', 'Opened date', 'Part number', 'Description', 'Requested by', 'Source', 'Times requested', 'Dollars', 'Status', 'Notes', 'Closed at', 'Updated at'],
  SOP: ['Item ID', 'Received date', 'Part number', 'Description', 'Customer', 'RO number', 'Dollars', 'Status', 'Notes', 'Closed at', 'Updated at'],
  BACKORDERS: ['Item ID', 'Opened date', 'Part number', 'Description', 'Vehicle', 'Reason', 'ETA', 'Severity', 'Status', 'Notes', 'Received at', 'Closed at', 'Updated at'],
  CORES: ['Item ID', 'Opened date', 'Part number', 'Description', 'Account or tech', 'Dollars', 'Days outstanding', 'Status', 'Notes', 'Closed at', 'Updated at'],
  CONFIG: ['Key', 'Value']
};

var PMR_DEFAULT_CAPITAL = 500000;
var PMR_DEFAULT_RIM_TARGET = 90;

/** Existing Geaux Chevrolet tabs PMR must never create, rename, hide, or write. */
var PMR_DO_NOT_TOUCH = [
  'HOME', 'SUMMARY', 'DEALINPUT', 'salesreview', 'NEWVEHICLES', 'INV', 'TREND',
  'SETTLEUP', 'MANAGER', 'SALESREP', 'REBATE', 'HITLIST', 'SETUP',
  'CUSTOMER_RESPONSES', 'SERVICE BOARD', 'FLEET CUSTOMERS', 'DESKDATA',
  'USEDCARS', 'DMV', 'PURCHASEPAPERWORK', 'PURCHASEUNITS', 'GMFRESIDUALGUIDE',
  'YTD', 'WORKTOOLS', 'LEASEWORKSHEET', 'DTLOG', 'DTDEALERDATABASE',
  'CONSOLIDATION', 'RECEIPTS', 'AUDITLOG', 'LOGDEAL', 'storage',
  'PARTS_ITEMS', 'SVC_PARTS_REQUESTS', 'PARTS_TICKETS', 'PARTS_TICKET_LINES',
  'ACCT_COA', 'SVC_RO', 'SVC_RO_LINES', 'ACCT_JOURNAL', 'ACCT_UNIT_META',
  'ACCT_UNIT_POSTINGS', 'ADMIN_EMPLOYEES', 'Deals_Database', 'PSCREEN',
  'DEALTRADES', 'DEALGROSS', 'DEALVEHICLE', 'DEALCUSTOMER', 'DEALREBATES',
  'DEALRECAP', 'DEALWEOWE', 'DEALLIENHOLDER', 'CUSTOMER', 'DATA',
  'ACCOUNTINGREBATE', 'INVENTORY', 'CHARGEBACKS', 'ACCOUNTINGENTRY',
  'LEASEWORKSHEETLOG', 'LEASEWORKSHEETLOG2', 'EMAIL_QUEUE', 'DAVID DESKING',
  'KERRY DESKING', 'KEITH DESKING', 'FINANCEDATABASE', 'STEVE DESKING',
  'QUOTE_STORE', 'DO NOT DELETE - AutoCrat Job Se',
  'SLM_Dashboard', 'SLM_Daily', 'SLM_Config',
  'SMR_Dashboard', 'SMR_TechHours', 'SMR_Gross', 'SMR_HeatCases', 'SMR_RepairOrders', 'SMR_Roster', 'SMR_Config',
  'FLM_Dashboard', 'FLM_Daily', 'FLM_Working', 'FLM_Goals', 'FLM_Config'
];

var PMR_PROP_PREFIX = 'PMR_';
var PMR_MENU_NAME = 'Parts Manager Report';

function PMR_workbookId_() {
  if (typeof PMR_WEB_WORKBOOK_ID === 'string' && PMR_WEB_WORKBOOK_ID) {
    return PMR_WEB_WORKBOOK_ID;
  }
  return '';
}

function PMR_hasBoundSpreadsheet_() {
  try {
    var ss = SpreadsheetApp.getActive();
    return !!(ss && ss.getId());
  } catch (ignore) {
    return false;
  }
}

function PMR_reservedSheetNames() {
  return Object.keys(PMR_SHEETS).map(function (key) {
    return PMR_SHEETS[key];
  });
}

function PMR_isPmrSheetName_(name) {
  return String(name || '').indexOf('PMR_') === 0;
}

function PMR_nowIso_() {
  return new Date().toISOString();
}

function PMR_toDateKey_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  if (text) {
    var parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  }
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function PMR_toNumber_(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }
  var num = Number(String(value).replace(/[$,%\s]/g, ''));
  return isFinite(num) ? num : 0;
}

function PMR_monthKey_(dateKey) {
  return PMR_toDateKey_(dateKey).slice(0, 7);
}

function PMR_roundMoney_(value) {
  return Math.round(PMR_toNumber_(value) * 100) / 100;
}

function PMR_daysBetween_(startKey, endKey) {
  var a = String(startKey || '').split('-');
  var b = String(endKey || '').split('-');
  var start = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
  var end = new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]));
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}
