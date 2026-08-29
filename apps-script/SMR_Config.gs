/**
 * Service Manager Report — isolated configuration.
 * Every identifier in this project is prefixed with SMR_ so it cannot
 * overwrite functions, menus, triggers, or properties used by other tools.
 */
var SMR_SHEETS = {
  DASHBOARD: 'SMR_Dashboard',
  TECH_HOURS: 'SMR_TechHours',
  GROSS: 'SMR_Gross',
  HEAT: 'SMR_HeatCases',
  ROS: 'SMR_RepairOrders',
  ROSTER: 'SMR_Roster',
  CONFIG: 'SMR_Config'
};

var SMR_HEADERS = {
  TECH_HOURS: ['Date', 'Tech name', 'Clock hours', 'Sold hours', 'Open ROs', 'Closed today', 'Written today', 'Notes', 'Submitted by', 'Submitted at'],
  GROSS: ['Date', 'Month', 'Period', 'Labor gross', 'Parts gross', 'Other gross', 'Total gross', 'Notes', 'Submitted by', 'Submitted at'],
  HEAT: ['Case ID', 'Opened date', 'Customer', 'RO number', 'Vehicle', 'Issue', 'Severity', 'Owner', 'Status', 'Briefed at', 'Resolved at', 'Resolution notes', 'Updated at', 'Advisor', 'Technician'],
  ROS: ['Date', 'Open ROs', 'Closed today', 'Written today', 'Notes', 'Submitted by', 'Submitted at'],
  ROSTER: ['Tech name', 'Active'],
  CONFIG: ['Key', 'Value']
};

var SMR_DEFAULT_ROSTER = [
  'BIG AL',
  'ELECTRIC-T',
  'DIESEL-E',
  'INTERNAL-F',
  'HEAVY-C',
  'SPECIAL-K',
  'LIL-J',
  'EASY-E',
  'DUEL FUEL-A'
];

var SMR_DEFAULT_ADVISORS = [
  'Cody Raffary'
];

/** Existing Geaux Chevrolet tabs SMR must never create, rename, hide, or write. */
var SMR_DO_NOT_TOUCH = [
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
  'QUOTE_STORE', 'DO NOT DELETE - AutoCrat Job Se'
];

var SMR_PROP_PREFIX = 'SMR_';
var SMR_MENU_NAME = 'Service Manager Report';

function SMR_reservedSheetNames() {
  return Object.keys(SMR_SHEETS).map(function (key) {
    return SMR_SHEETS[key];
  });
}

function SMR_isSmrSheetName_(name) {
  return String(name || '').indexOf('SMR_') === 0;
}

function SMR_nowIso_() {
  return new Date().toISOString();
}

function SMR_toDateKey_(value) {
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

function SMR_toNumber_(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }
  var num = Number(String(value).replace(/[$,%\s]/g, ''));
  return isFinite(num) ? num : 0;
}

function SMR_monthKey_(dateKey) {
  return SMR_toDateKey_(dateKey).slice(0, 7);
}
