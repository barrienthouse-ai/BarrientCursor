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

function SLM_pad2_(value) {
  return Number(value) < 10 ? '0' + Number(value) : String(value);
}

function SLM_normalizeYear_(year) {
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

function SLM_parseSheetDate_(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    try {
      return Utilities.formatDate(value, Session.getScriptTimeZone() || 'America/Chicago', 'yyyy-MM-dd');
    } catch (ignoreTz) {
      if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0) {
        return value.getUTCFullYear() + '-' + SLM_pad2_(value.getUTCMonth() + 1) + '-' + SLM_pad2_(value.getUTCDate());
      }
      return value.getFullYear() + '-' + SLM_pad2_(value.getMonth() + 1) + '-' + SLM_pad2_(value.getDate());
    }
  }
  if (typeof value === 'number' && isFinite(value) && value > 20000 && value < 80000) {
    var excel = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return excel.getUTCFullYear() + '-' + SLM_pad2_(excel.getUTCMonth() + 1) + '-' + SLM_pad2_(excel.getUTCDate());
  }
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return SLM_normalizeYear_(text.slice(0, 4)) + text.slice(4, 10);
  }
  var us = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (us) {
    var month = Number(us[1]);
    var day = Number(us[2]);
    var year = SLM_normalizeYear_(us[3]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return year + '-' + SLM_pad2_(month) + '-' + SLM_pad2_(day);
    }
  }
  return '';
}

function SLM_toDateKey_(value) {
  return SLM_parseSheetDate_(value) || SLM_todayKey_();
}

function SLM_dateKeyFast_(value) {
  return SLM_parseSheetDate_(value);
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
