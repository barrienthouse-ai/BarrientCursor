/**
 * Spreadsheet-backed configuration.
 *
 * Editable sheets (auto-created with defaults on first run):
 *   CONFIG            key / value store settings, fees, branding, emails
 *   MANAGER_STAGING   manager name match → DESKDATA staging row
 *   QUOTE_CATALOG     protection packages + accessories (no code change needed)
 *   QUOTE_RATES       APR matrix by term × credit tier
 *   CREDIT_TIERS      customer-facing credit tier labels / FICO bands
 */

var DEFAULT_STORE_CITY_ = 'LaPlace, LA';

var DEFAULT_FEES_ = {
  docFee: 436.00,
  titleFee: 68.50,
  licenseFee: 70.00,
  recordationFee: 15.00,
  tempTag: 4.00,
  wasteTire: 11.25,
  stateInspection: 0.00,
  handlingFee: 8.00,
  notaryFee: 15.00,
  convenienceFee: 26.00,
  autoguardPrice: 495.00,
  taxRate: 9.50
};

function withSheetLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getActiveSs_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureConfigSheets() {
  var ss = getActiveSs_();
  ensureConfigSheet_(ss);
  ensureManagerSheet_(ss);
  ensureCatalogSheet_(ss);
  ensureRatesSheet_(ss);
  ensureTiersSheet_(ss);
}

function headerStyle_(sheet, cols) {
  sheet.getRange(1, 1, 1, cols)
    .setFontWeight('bold')
    .setBackground('#0d1f33')
    .setFontColor('white');
  sheet.setFrozenRows(1);
}

function isGonzalesCity_(value) {
  return /gonzales/i.test(String(value || ''));
}

function migrateStoreCity_(sheet) {
  var data = sheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() !== 'storeCity') continue;
    found = true;
    if (isGonzalesCity_(data[i][1])) {
      sheet.getRange(i + 1, 2).setValue(DEFAULT_STORE_CITY_);
    }
    return;
  }
  if (!found) {
    sheet.appendRow(['storeCity', DEFAULT_STORE_CITY_, 'City line on quote / emails']);
  }
}

function ensureConfigSheet_(ss) {
  var sheet = ss.getSheetByName('CONFIG');
  if (!sheet) {
    sheet = ss.insertSheet('CONFIG');
    sheet.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'Notes']]);
    headerStyle_(sheet, 3);
    var rows = [
      ['storeName', 'GEAUX Chevrolet', 'Customer-facing store name'],
      ['storeCity', DEFAULT_STORE_CITY_, 'City line on quote / emails'],
      ['storePhone', '(225) 644-8411', 'Customer-facing phone'],
      ['notifyEmails', 'dbarrient@geauxautomotive.com,swinkler@geauxautomotive.com,kcoulon@geauxautomotive.com,kmumphrey@geauxautomotive.com', 'Comma-separated quote notification recipients'],
      ['quoteTtlDays', '14', 'Shareable quote link lifetime in days'],
      ['defaultTerm', '72', 'Default finance term (months)'],
      ['allowTermChange', 'yes', 'yes = customer can change term on the quote'],
      ['defaultCreditTier', 'a1', 'Starting credit tier on the quote'],
      ['useOddDaysOnQuote', 'yes', 'yes = match desk payment (odd-days interest past 30)'],
      ['docFee', String(DEFAULT_FEES_.docFee), 'Default doc fee'],
      ['titleFee', String(DEFAULT_FEES_.titleFee), ''],
      ['licenseFee', String(DEFAULT_FEES_.licenseFee), ''],
      ['recordationFee', String(DEFAULT_FEES_.recordationFee), ''],
      ['tempTag', String(DEFAULT_FEES_.tempTag), ''],
      ['wasteTire', String(DEFAULT_FEES_.wasteTire), ''],
      ['stateInspection', String(DEFAULT_FEES_.stateInspection), ''],
      ['handlingFee', String(DEFAULT_FEES_.handlingFee), ''],
      ['notaryFee', String(DEFAULT_FEES_.notaryFee), ''],
      ['convenienceFee', String(DEFAULT_FEES_.convenienceFee), ''],
      ['autoguardPrice', String(DEFAULT_FEES_.autoguardPrice), 'Default Autoguard selling price'],
      ['taxRate', String(DEFAULT_FEES_.taxRate), 'Default sales tax rate %']
    ];
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 420);
    sheet.setColumnWidth(3, 280);
  } else {
    migrateStoreCity_(sheet);
  }
}

function ensureManagerSheet_(ss) {
  var sheet = ss.getSheetByName('MANAGER_STAGING');
  if (!sheet) {
    sheet = ss.insertSheet('MANAGER_STAGING');
    sheet.getRange(1, 1, 1, 3).setValues([['Match', 'StagingRow', 'Notes']]);
    headerStyle_(sheet, 3);
    sheet.getRange(2, 1, 4, 3).setValues([
      ['KERRY', 1, 'DESKDATA row 1 — match is case-insensitive substring of manager name'],
      ['DAVID', 2, 'DESKDATA row 2'],
      ['KEITH', 3, 'DESKDATA row 3'],
      ['STEVE', 4, 'DESKDATA row 4']
    ]);
  }
}

function defaultCatalogRows_() {
  return [
    ['warranty', 'protection', 'Extended Warranty', 'Bumper-to-bumper coverage beyond factory warranty. Covers major mechanical & electrical components.', 2848, 'FALSE', 'FALSE', 10, 'TRUE'],
    ['gap', 'protection', 'GAP Insurance', 'Covers the difference between your loan balance and the vehicle actual cash value in a total loss.', 895, 'FALSE', 'FALSE', 20, 'TRUE'],
    ['key', 'protection', 'Key Protection', 'Replacement coverage for lost, stolen, or damaged keys and key fobs. Includes lockout service.', 419, 'TRUE', 'FALSE', 30, 'TRUE'],
    ['roadhazard', 'protection', 'Road Hazard Protection', 'Covers tire and wheel damage from potholes, nails, glass, and road debris. Includes towing.', 688, 'TRUE', 'FALSE', 40, 'TRUE'],
    ['windshield', 'protection', 'Windshield Protection', 'Unlimited windshield chip repairs and crack coverage. No deductible.', 759, 'TRUE', 'FALSE', 50, 'TRUE'],
    ['paint', 'protection', 'Paint & Interior Sealant', 'Professional-grade paint sealant and interior fabric protection.', 481, 'TRUE', 'FALSE', 60, 'TRUE'],
    ['flrmats', 'accessory', 'All-Weather Floor Mats', 'Heavy-duty custom-fit floor mats — front & rear set.', 359, 'TRUE', 'FALSE', 10, 'TRUE'],
    ['bedliner', 'accessory', 'Spray-In Bed Liner', 'Professional spray-in bed liner for maximum truck bed protection.', 595, 'TRUE', 'FALSE', 20, 'TRUE'],
    ['runboards', 'accessory', 'Running Boards / Side Steps', 'Powder-coated steel running boards for easy cab entry.', 895, 'TRUE', 'FALSE', 30, 'TRUE'],
    ['powerboards', 'accessory', 'Power Running Boards / Side Steps', 'Auto power running boards for easy cab entry.', 2495, 'TRUE', 'FALSE', 40, 'TRUE'],
    ['tonneauhard', 'accessory', 'Tonneau Cover (Tri-fold Hard)', 'Tri-fold hard tonneau cover — protects cargo, improves fuel economy.', 1895, 'TRUE', 'FALSE', 50, 'TRUE'],
    ['tonneau', 'accessory', 'Tonneau Cover (Soft Folding)', 'Soft folding tonneau cover — protects cargo, improves fuel economy.', 895, 'TRUE', 'FALSE', 60, 'TRUE'],
    ['hitch', 'accessory', 'Trailer Hitch & Wiring', '2" receiver hitch with 7-pin wiring harness. Factory-style install.', 695, 'TRUE', 'FALSE', 70, 'TRUE'],
    ['remstart', 'accessory', 'Remote Start System', 'OEM-compatible remote start with smartphone app integration.', 595, 'TRUE', 'FALSE', 80, 'TRUE'],
    ['wheellocks', 'accessory', 'Wheel Locks', 'Anti-theft locking lug nuts for all four wheels.', 189, 'TRUE', 'FALSE', 90, 'TRUE'],
    ['mudflaps', 'accessory', 'Mud Flaps / Splash Guards', 'Custom-fit molded splash guards — front & rear.', 149, 'TRUE', 'FALSE', 100, 'TRUE'],
    ['tint', 'accessory', 'Window Tint', 'Professional ceramic window tint — all side and rear windows.', 395, 'TRUE', 'FALSE', 110, 'TRUE'],
    ['seats3row', 'accessory', '3 Row Leather Seats', 'Premium 3-row leather seat upgrade — all rows.', 1998, 'TRUE', 'FALSE', 120, 'TRUE'],
    ['seats2row', 'accessory', '2 Row Leather Seats', 'Custom-fit leather seats — front & rear.', 1449, 'TRUE', 'FALSE', 130, 'TRUE'],
    ['cargonet', 'accessory', 'Cargo Net / Organizer', 'Heavy-duty cargo net and trunk organizer set.', 79, 'TRUE', 'FALSE', 140, 'TRUE']
  ];
}

function ensureCatalogSheet_(ss) {
  var sheet = ss.getSheetByName('QUOTE_CATALOG');
  if (!sheet) {
    sheet = ss.insertSheet('QUOTE_CATALOG');
    sheet.getRange(1, 1, 1, 9).setValues([[
      'Id', 'Category', 'Name', 'Description', 'Price', 'Taxable', 'DefaultOn', 'Sort', 'Active'
    ]]);
    headerStyle_(sheet, 9);
    var rows = defaultCatalogRows_();
    sheet.getRange(2, 1, rows.length, 9).setValues(rows);
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(3, 260);
    sheet.setColumnWidth(4, 420);
    sheet.getRange(1, 2, 1, 1).setNote('protection or accessory');
    sheet.getRange(1, 6, 1, 1).setNote('FALSE for typical VSC/GAP (not sales-taxed)');
  }
}

function ensureRatesSheet_(ss) {
  var sheet = ss.getSheetByName('QUOTE_RATES');
  if (!sheet) {
    sheet = ss.insertSheet('QUOTE_RATES');
    sheet.getRange(1, 1, 1, 7).setValues([['Term', 'a1', 'a2', 'a3', 'b1', 'b2', 'b3']]);
    headerStyle_(sheet, 7);
    sheet.getRange(2, 1, 10, 7).setValues([
      [36, 5.69, 5.94, 8.34, 12.39, 14.15, 16.49],
      [48, 5.94, 6.19, 8.59, 12.64, 14.84, 16.89],
      [60, 5.94, 6.19, 8.59, 12.64, 14.84, 16.89],
      [63, 5.94, 6.19, 8.59, 12.64, 14.84, 16.89],
      [66, 6.19, 6.44, 8.99, 13.04, 15.15, 17.49],
      [72, 6.19, 6.44, 8.99, 13.04, 15.15, 17.69],
      [75, 6.19, 6.44, 8.99, 13.04, 15.15, 17.99],
      [78, 6.34, 6.59, 9.14, '', '', ''],
      [84, 6.34, 6.59, 9.14, '', '', ''],
      [96, 7.24, 7.64, '', '', '', '']
    ]);
    sheet.getRange(1, 1, 1, 1).setNote('Leave a tier cell blank if that term is not available for the tier.');
  }
}

function ensureTiersSheet_(ss) {
  var sheet = ss.getSheetByName('CREDIT_TIERS');
  if (!sheet) {
    sheet = ss.insertSheet('CREDIT_TIERS');
    sheet.getRange(1, 1, 1, 4).setValues([['Key', 'Label', 'FicoRange', 'Sort']]);
    headerStyle_(sheet, 4);
    sheet.getRange(2, 1, 6, 4).setValues([
      ['a1', 'Excellent Credit — A1', 'FICO 750+', 10],
      ['a2', 'Very Good — A2', 'FICO 690–749', 20],
      ['a3', 'Good Credit — A3', 'FICO 650–689', 30],
      ['b1', 'Fair Credit — B1', 'FICO 620–649', 40],
      ['b2', 'Below Average — B2', 'FICO 570–619', 50],
      ['b3', 'Rebuilding Credit — B3', 'FICO 569 & Below', 60]
    ]);
  }
}

function getConfigMap() {
  ensureConfigSheets();
  var sheet = getActiveSs_().getSheetByName('CONFIG');
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0] || '').trim();
    if (key) map[key] = data[i][1];
  }
  return map;
}

function cfgStr_(map, key, fallback) {
  if (map[key] === undefined || map[key] === null || map[key] === '') return fallback;
  return String(map[key]);
}

function cfgNum_(map, key, fallback) {
  var n = parseFloat(map[key]);
  return isNaN(n) ? fallback : n;
}

function cfgYes_(map, key, fallbackYes) {
  var v = map[key];
  if (v === undefined || v === null || v === '') return !!fallbackYes;
  var s = String(v).toLowerCase();
  return s === 'yes' || s === 'true' || s === 'y' || s === '1';
}

function getDefaultFees() {
  var map = getConfigMap();
  return {
    docFee: cfgNum_(map, 'docFee', DEFAULT_FEES_.docFee),
    titleFee: cfgNum_(map, 'titleFee', DEFAULT_FEES_.titleFee),
    licenseFee: cfgNum_(map, 'licenseFee', DEFAULT_FEES_.licenseFee),
    recordationFee: cfgNum_(map, 'recordationFee', DEFAULT_FEES_.recordationFee),
    tempTag: cfgNum_(map, 'tempTag', DEFAULT_FEES_.tempTag),
    wasteTire: cfgNum_(map, 'wasteTire', DEFAULT_FEES_.wasteTire),
    stateInspection: cfgNum_(map, 'stateInspection', DEFAULT_FEES_.stateInspection),
    handlingFee: cfgNum_(map, 'handlingFee', DEFAULT_FEES_.handlingFee),
    notaryFee: cfgNum_(map, 'notaryFee', DEFAULT_FEES_.notaryFee),
    convenienceFee: cfgNum_(map, 'convenienceFee', DEFAULT_FEES_.convenienceFee),
    autoguardPrice: cfgNum_(map, 'autoguardPrice', DEFAULT_FEES_.autoguardPrice),
    taxRate: cfgNum_(map, 'taxRate', DEFAULT_FEES_.taxRate)
  };
}

function getStoreSettings() {
  var map = getConfigMap();
  var city = cfgStr_(map, 'storeCity', DEFAULT_STORE_CITY_);
  if (isGonzalesCity_(city)) city = DEFAULT_STORE_CITY_;
  return {
    storeName: cfgStr_(map, 'storeName', 'GEAUX Chevrolet'),
    storeCity: city,
    storePhone: cfgStr_(map, 'storePhone', '(225) 644-8411'),
    notifyEmails: cfgStr_(map, 'notifyEmails', ''),
    quoteTtlDays: cfgNum_(map, 'quoteTtlDays', 14),
    defaultTerm: cfgNum_(map, 'defaultTerm', 72),
    allowTermChange: cfgYes_(map, 'allowTermChange', true),
    defaultCreditTier: cfgStr_(map, 'defaultCreditTier', 'a1'),
    useOddDaysOnQuote: cfgYes_(map, 'useOddDaysOnQuote', true)
  };
}

function getManagerStagingRows() {
  ensureConfigSheets();
  var sheet = getActiveSs_().getSheetByName('MANAGER_STAGING');
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var match = String(data[i][0] || '').trim();
    var row = parseInt(data[i][1], 10);
    if (!match || isNaN(row) || row < 1) continue;
    rows.push({ match: match, row: row });
  }
  return rows;
}

function getStagingRow_(manager) {
  var list = getManagerStagingRows();
  var m = String(manager || '').toUpperCase();
  if (!m) return 0;
  for (var i = 0; i < list.length; i++) {
    if (m.indexOf(String(list[i].match).toUpperCase()) !== -1) return list[i].row;
  }
  return 0;
}

function requireStagingRow_(manager) {
  var row = getStagingRow_(manager);
  if (!row) {
    throw new Error('Select a Manager that matches MANAGER_STAGING (Match column) before saving, printing, or quoting.');
  }
  return row;
}

function parseBoolCell_(v, defaultVal) {
  if (v === undefined || v === null || v === '') return defaultVal;
  if (v === true || v === false) return v;
  var s = String(v).toUpperCase();
  if (s === 'TRUE' || s === 'YES' || s === 'Y' || s === '1') return true;
  if (s === 'FALSE' || s === 'NO' || s === 'N' || s === '0') return false;
  return defaultVal;
}

function getQuoteCatalog() {
  ensureConfigSheets();
  var sheet = getActiveSs_().getSheetByName('QUOTE_CATALOG');
  var data = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0] || '').trim();
    if (!id) continue;
    items.push({
      id: id,
      category: String(data[i][1] || 'accessory').trim().toLowerCase(),
      name: String(data[i][2] || id).trim(),
      description: String(data[i][3] || '').trim(),
      price: toNumber_(data[i][4]),
      taxable: parseBoolCell_(data[i][5], true),
      defaultOn: parseBoolCell_(data[i][6], false),
      sort: toNumber_(data[i][7]),
      active: parseBoolCell_(data[i][8], true)
    });
  }
  items.sort(function (a, b) {
    if (a.category !== b.category) return a.category < b.category ? 1 : -1;
    return a.sort - b.sort;
  });
  return items;
}

function getProtectionCatalog() {
  return getQuoteCatalog().filter(function (i) { return i.category === 'protection' && i.active; });
}

function getAccessoryCatalog() {
  return getQuoteCatalog().filter(function (i) { return i.category === 'accessory' && i.active; });
}

function getRateMatrix() {
  ensureConfigSheets();
  var sheet = getActiveSs_().getSheetByName('QUOTE_RATES');
  var data = sheet.getDataRange().getValues();
  var header = data[0] || [];
  var matrix = {};
  for (var i = 1; i < data.length; i++) {
    var term = parseInt(data[i][0], 10);
    if (!term) continue;
    var row = {};
    for (var c = 1; c < header.length; c++) {
      var key = String(header[c] || '').trim();
      if (!key) continue;
      var raw = data[i][c];
      if (raw === '' || raw === null) row[key] = null;
      else {
        var n = parseFloat(raw);
        row[key] = isNaN(n) ? null : n;
      }
    }
    matrix[String(term)] = row;
  }
  return matrix;
}

function getCreditTiers() {
  ensureConfigSheets();
  var sheet = getActiveSs_().getSheetByName('CREDIT_TIERS');
  var data = sheet.getDataRange().getValues();
  var tiers = [];
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0] || '').trim();
    if (!key) continue;
    tiers.push({
      key: key,
      label: String(data[i][1] || key).trim(),
      ficoRange: String(data[i][2] || '').trim(),
      sort: toNumber_(data[i][3])
    });
  }
  tiers.sort(function (a, b) { return a.sort - b.sort; });
  return tiers;
}

function getQuoteRuntimeConfig(deskData) {
  var settings = getStoreSettings();
  var protection = filterCatalogAgainstDesk(getProtectionCatalog(), deskData || {});
  var accessories = filterCatalogAgainstDesk(getAccessoryCatalog(), deskData || {});
  return {
    settings: settings,
    protection: protection,
    accessories: accessories,
    rates: getRateMatrix(),
    tiers: getCreditTiers()
  };
}
