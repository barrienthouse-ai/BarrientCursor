/**
 * Sales Manager Report — isolated configuration.
 * Every identifier is prefixed with SLM_ so it cannot overwrite
 * functions, menus, triggers, or properties used by other tools
 * (including the Service Manager Report SMR_* namespace).
 */
var SLM_SHEETS = {
  DASHBOARD: 'SLM_Dashboard',
  DAILY: 'SLM_Daily',
  CONFIG: 'SLM_Config'
};

var SLM_HEADERS = {
  DAILY: [
    'Date',
    'New sold',
    'Used sold',
    'Total sold',
    'Front gross',
    'Back gross',
    'Total gross',
    'Appointments',
    'Shown appointments',
    'Showroom visits',
    'Next day appointments',
    'Next business date',
    'Notes',
    'Submitted by',
    'Submitted at',
    'Source'
  ],
  CONFIG: ['Key', 'Value']
};

/** Existing Geaux Chevrolet tabs SLM must never create, rename, hide, or write. */
var SLM_DO_NOT_TOUCH = [
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
  'SMR_RepairOrders', 'SMR_Roster', 'SMR_Config'
];

var SLM_PROP_PREFIX = 'SLM_';
var SLM_MENU_NAME = 'Sales Manager Report';
var SLM_DEAL_SHEET = 'DEALINPUT';

function SLM_reservedSheetNames() {
  return Object.keys(SLM_SHEETS).map(function (key) {
    return SLM_SHEETS[key];
  });
}

function SLM_isSlmSheetName_(name) {
  return String(name || '').indexOf('SLM_') === 0;
}

function SLM_nowIso_() {
  return new Date().toISOString();
}

function SLM_toDateKey_(value) {
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

function SLM_dateKeyFast_(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    var month = value.getMonth() + 1;
    var day = value.getDate();
    return value.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
  }
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  return '';
}

function SLM_toNumber_(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }
  var num = Number(String(value).replace(/[$,%\s]/g, ''));
  return isFinite(num) ? num : 0;
}

function SLM_roundMoney_(value) {
  return Math.round(SLM_toNumber_(value) * 100) / 100;
}

function SLM_monthKey_(dateKey) {
  return SLM_toDateKey_(dateKey).slice(0, 7);
}

function SLM_addDaysKey_(dateKey, days) {
  var parts = String(dateKey || '').split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() + Number(days || 0));
  return SLM_dateKeyFast_(date);
}

function SLM_nextBusinessDay_(dateKey) {
  var key = SLM_addDaysKey_(dateKey, 1);
  for (var i = 0; i < 8; i++) {
    var parts = key.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (date.getDay() !== 0) {
      return key;
    }
    key = SLM_addDaysKey_(key, 1);
  }
  return key;
}

function SLM_isRetail_(value) {
  return String(value || '').trim().toUpperCase() === 'RETAIL';
}

function SLM_dept_(value) {
  var dept = String(value || '').trim().toUpperCase();
  if (dept === 'NEW') {
    return 'new';
  }
  if (dept === 'USED') {
    return 'used';
  }
  return 'other';
}

function SLM_todayKey_() {
  try {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (ignore) {
    return SLM_dateKeyFast_(new Date());
  }
}

function SLM_safeJson_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function SLM_emptyTotals_() {
  return {
    newSold: 0,
    usedSold: 0,
    totalSold: 0,
    frontGross: 0,
    backGross: 0,
    totalGross: 0,
    dealCount: 0
  };
}
