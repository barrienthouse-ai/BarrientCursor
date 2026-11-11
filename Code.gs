/**
 * Deal Logger — Google Sheets sidebar add-on
 * Opens a side panel to capture deals into a "Deals" sheet.
 */

var DEALS_SHEET_NAME = 'Deals';
var HEADER_ROW = [
  'Logged At',
  'Deal Name',
  'Company',
  'Amount',
  'Stage',
  'Probability %',
  'Expected Close',
  'Owner',
  'Notes'
];

var STAGES = [
  'Prospecting',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost'
];

/**
 * Adds a custom menu when the spreadsheet opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Deal Logger')
    .addItem('Open sidebar', 'showDealSidebar')
    .addItem('Ensure Deals sheet', 'ensureDealsSheet')
    .addToUi();
}

/**
 * Opens the deal logger in the Sheets side panel.
 */
function showDealSidebar() {
  ensureDealsSheet_();
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Deal Logger')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Menu action: create/repair the Deals sheet headers.
 */
function ensureDealsSheet() {
  ensureDealsSheet_();
  SpreadsheetApp.getUi().alert('Deals sheet is ready.');
}

/**
 * Returns static options used to populate the sidebar form.
 */
function getFormOptions() {
  return {
    stages: STAGES,
    owners: getKnownOwners_(),
    recentDeals: getRecentDeals_(8)
  };
}

/**
 * Validates and appends a deal row. Called from the sidebar via google.script.run.
 *
 * @param {Object} deal
 * @return {{ok: boolean, message: string, deal?: Object}}
 */
function logDeal(deal) {
  try {
    var normalized = normalizeDeal_(deal);
    var sheet = ensureDealsSheet_();
    sheet.appendRow([
      normalized.loggedAt,
      normalized.dealName,
      normalized.company,
      normalized.amount,
      normalized.stage,
      normalized.probability,
      normalized.expectedClose,
      normalized.owner,
      normalized.notes
    ]);

    return {
      ok: true,
      message: 'Logged “' + normalized.dealName + '”.',
      deal: normalized,
      recentDeals: getRecentDeals_(8)
    };
  } catch (err) {
    return {
      ok: false,
      message: String(err && err.message ? err.message : err)
    };
  }
}

/**
 * @return {Object[]}
 */
function getRecentDeals() {
  return getRecentDeals_(8);
}

/** @private */
function ensureDealsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DEALS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DEALS_SHEET_NAME);
  }

  var existing = sheet.getRange(1, 1, 1, HEADER_ROW.length).getValues()[0];
  var isEmpty = sheet.getLastRow() === 0;
  var headerMismatch = false;
  if (!isEmpty) {
    for (var i = 0; i < HEADER_ROW.length; i++) {
      if (String(existing[i] || '') !== HEADER_ROW[i]) {
        headerMismatch = true;
        break;
      }
    }
  }

  if (isEmpty) {
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
    sheet.getRange(1, 1, 1, HEADER_ROW.length)
      .setFontWeight('bold')
      .setBackground('#1f4e46')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADER_ROW.length, 130);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(9, 220);
  } else if (headerMismatch) {
    // Sheet has data but missing our header contract — write headers only if blank row 1.
    var row1Empty = existing.every(function (cell) {
      return String(cell || '').trim() === '';
    });
    if (row1Empty) {
      sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

/** @private */
function normalizeDeal_(deal) {
  if (!deal || typeof deal !== 'object') {
    throw new Error('No deal data received.');
  }

  var dealName = String(deal.dealName || '').trim();
  var company = String(deal.company || '').trim();
  var stage = String(deal.stage || '').trim();
  var owner = String(deal.owner || '').trim();
  var notes = String(deal.notes || '').trim();
  var expectedClose = String(deal.expectedClose || '').trim();

  if (!dealName) {
    throw new Error('Deal name is required.');
  }
  if (!company) {
    throw new Error('Company is required.');
  }
  if (!stage || STAGES.indexOf(stage) === -1) {
    throw new Error('Pick a valid stage.');
  }

  var amount = Number(String(deal.amount || '').replace(/[$,\s]/g, ''));
  if (!isFinite(amount) || amount < 0) {
    throw new Error('Enter a valid amount (0 or greater).');
  }

  var probability = deal.probability === '' || deal.probability == null
    ? defaultProbability_(stage)
    : Number(deal.probability);
  if (!isFinite(probability) || probability < 0 || probability > 100) {
    throw new Error('Probability must be between 0 and 100.');
  }

  if (!owner) {
    owner = Session.getActiveUser().getEmail() || 'Unknown';
  }

  return {
    loggedAt: new Date(),
    dealName: dealName,
    company: company,
    amount: amount,
    stage: stage,
    probability: Math.round(probability),
    expectedClose: expectedClose,
    owner: owner,
    notes: notes
  };
}

/** @private */
function defaultProbability_(stage) {
  var map = {
    Prospecting: 10,
    Qualification: 25,
    Proposal: 50,
    Negotiation: 75,
    'Closed Won': 100,
    'Closed Lost': 0
  };
  return map[stage] != null ? map[stage] : 0;
}

/** @private */
function getKnownOwners_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DEALS_SHEET_NAME);
  var owners = {};
  var email = Session.getActiveUser().getEmail();
  if (email) {
    owners[email] = true;
  }
  if (!sheet || sheet.getLastRow() < 2) {
    return Object.keys(owners);
  }
  var values = sheet.getRange(2, 8, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var owner = String(values[i][0] || '').trim();
    if (owner) {
      owners[owner] = true;
    }
  }
  return Object.keys(owners).sort();
}

/** @private */
function getRecentDeals_(limit) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DEALS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  var startRow = Math.max(2, sheet.getLastRow() - limit + 1);
  var numRows = sheet.getLastRow() - startRow + 1;
  var rows = sheet.getRange(startRow, 1, numRows, HEADER_ROW.length).getValues();
  var deals = [];

  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    if (!String(row[1] || '').trim()) {
      continue;
    }
    deals.push({
      loggedAt: formatDateTime_(row[0]),
      dealName: String(row[1] || ''),
      company: String(row[2] || ''),
      amount: Number(row[3]) || 0,
      stage: String(row[4] || ''),
      probability: Number(row[5]) || 0,
      expectedClose: formatDate_(row[6]),
      owner: String(row[7] || ''),
      notes: String(row[8] || '')
    });
  }
  return deals;
}

/** @private */
function formatDateTime_(value) {
  if (!value) {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
  }
  return String(value);
}

/** @private */
function formatDate_(value) {
  if (!value) {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}
