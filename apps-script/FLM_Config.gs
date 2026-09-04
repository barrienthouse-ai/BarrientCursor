/**
 * Fleet Manager Report — isolated configuration.
 * Every identifier is prefixed with FLM_ so it cannot overwrite
 * functions, menus, triggers, or properties used by other tools
 * (including SMR_* service and SLM_* sales namespaces).
 */
var FLM_SHEETS = {
  DASHBOARD: 'FLM_Dashboard',
  DAILY: 'FLM_Daily',
  WORKING: 'FLM_Working',
  GOALS: 'FLM_Goals',
  CONFIG: 'FLM_Config'
};

var FLM_HEADERS = {
  DAILY: [
    'Date',
    'Sold deals',
    'Working deals',
    'Front gross',
    'Finance gross',
    'Total gross',
    'Deliveries',
    'Courtesy deliveries',
    'Expected deliveries',
    'Notes',
    'Submitted by',
    'Submitted at',
    'Source'
  ],
  WORKING: [
    'Deal ID',
    'Opened date',
    'Customer',
    'Account',
    'Stock',
    'Vehicle',
    'Units',
    'Front gross',
    'Finance gross',
    'Total gross',
    'Expected delivery',
    'Status',
    'Notes',
    'Submitted by',
    'Updated at'
  ],
  GOALS: ['Month', 'Unit goal', 'Gross goal', 'Notes', 'Submitted by', 'Submitted at'],
  CONFIG: ['Key', 'Value']
};

var FLM_DEFAULT_CUSTOMERS = [
  'Entergy Louisiana',
  'Jefferson Parish',
  'St. Charles Parish',
  'Lafayette Utilities',
  'Acadian Ambulance',
  'Cox Communications',
  'AT&T Fleet',
  'Louisiana DOTD'
];

/** Existing Geaux Chevrolet tabs FLM must never create, rename, hide, or write. */
var FLM_DO_NOT_TOUCH = [
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
  'SMR_Dashboard', 'SMR_TechHours', 'SMR_Gross', 'SMR_HeatCases',
  'SMR_RepairOrders', 'SMR_Roster', 'SMR_Config',
  'SLM_Dashboard', 'SLM_Daily', 'SLM_Config'
];

var FLM_PROP_PREFIX = 'FLM_';
var FLM_MENU_NAME = 'Fleet Manager Report';
var FLM_DEAL_SHEET = 'DEALINPUT';

function FLM_workbookId_() {
  if (typeof FLM_WEB_WORKBOOK_ID === 'string' && FLM_WEB_WORKBOOK_ID) {
    return FLM_WEB_WORKBOOK_ID;
  }
  return '';
}

function FLM_hasBoundSpreadsheet_() {
  try {
    var ss = SpreadsheetApp.getActive();
    return !!(ss && ss.getId());
  } catch (ignore) {
    return false;
  }
}

function FLM_reservedSheetNames() {
  return Object.keys(FLM_SHEETS).map(function (key) {
    return FLM_SHEETS[key];
  });
}

function FLM_isFlmSheetName_(name) {
  return String(name || '').indexOf('FLM_') === 0;
}

function FLM_nowIso_() {
  return new Date().toISOString();
}

function FLM_pad2_(value) {
  return Number(value) < 10 ? '0' + Number(value) : String(value);
}

function FLM_normalizeYear_(year) {
  var num = Number(year);
  if (!isFinite(num) || num <= 0) {
    return 0;
  }
  if (num < 100) {
    return num >= 50 ? 1900 + num : 2000 + num;
  }
  if (num < 1000) {
    return 2000 + (num % 100);
  }
  return num;
}

function FLM_parseSheetDate_(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    try {
      return Utilities.formatDate(value, Session.getScriptTimeZone() || 'America/Chicago', 'yyyy-MM-dd');
    } catch (ignoreTz) {
      return value.getFullYear() + '-' + FLM_pad2_(value.getMonth() + 1) + '-' + FLM_pad2_(value.getDate());
    }
  }
  if (typeof value === 'number' && isFinite(value) && value > 20000 && value < 80000) {
    var excel = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return excel.getUTCFullYear() + '-' + FLM_pad2_(excel.getUTCMonth() + 1) + '-' + FLM_pad2_(excel.getUTCDate());
  }
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return FLM_normalizeYear_(text.slice(0, 4)) + text.slice(4, 10);
  }
  var us = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (us) {
    var month = Number(us[1]);
    var day = Number(us[2]);
    var year = FLM_normalizeYear_(us[3]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return year + '-' + FLM_pad2_(month) + '-' + FLM_pad2_(day);
    }
  }
  return '';
}

function FLM_toDateKey_(value) {
  return FLM_parseSheetDate_(value) || FLM_todayKey_();
}

function FLM_dateKeyFast_(value) {
  return FLM_parseSheetDate_(value);
}

function FLM_toNumber_(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }
  var num = Number(String(value).replace(/[$,%\s]/g, ''));
  return isFinite(num) ? num : 0;
}

function FLM_roundMoney_(value) {
  return Math.round(FLM_toNumber_(value) * 100) / 100;
}

function FLM_monthKey_(dateKey) {
  return FLM_toDateKey_(dateKey).slice(0, 7);
}

function FLM_addDaysKey_(dateKey, days) {
  var parts = String(dateKey || '').split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() + Number(days || 0));
  return FLM_dateKeyFast_(date);
}

function FLM_nextBusinessDay_(dateKey) {
  var key = FLM_addDaysKey_(dateKey, 1);
  for (var i = 0; i < 8; i++) {
    var parts = key.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (date.getDay() !== 0) {
      return key;
    }
    key = FLM_addDaysKey_(key, 1);
  }
  return key;
}

function FLM_isFleet_(type, dept) {
  var t = String(type || '').trim().toUpperCase();
  var d = String(dept || '').trim().toUpperCase();
  return t === 'FLEET' || t === 'COMMERCIAL' || t === 'FLEET/COMMERCIAL' || d === 'FLEET' || d === 'COMMERCIAL';
}

function FLM_todayKey_() {
  try {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (ignore) {
    return FLM_dateKeyFast_(new Date());
  }
}

function FLM_safeJson_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function FLM_emptyTotals_() {
  return {
    soldDeals: 0,
    frontGross: 0,
    financeGross: 0,
    totalGross: 0,
    dealCount: 0,
    units: 0
  };
}
