/**
 * Spreadsheet-backed configuration.
 *
 * Editable sheets (auto-created with defaults on first run):
 *   CONFIG            key / value store settings, fees, branding, emails
 *   MANAGER_STAGING   manager name match → DESKDATA staging row
 *   QUOTE_CATALOG     F&I coverages + optional accessories. Edit Price / BrochureUrl here.
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

var CATALOG_HEADERS_ = ['Id', 'Category', 'Name', 'Description', 'Price', 'Taxable', 'DefaultOn', 'Sort', 'Active', 'BrochureUrl', 'Provider'];

var BROCHURE_FOLDER_NAME_ = 'GEAUX Quote Brochures';

var BROCHURE_FILES_ = {
  mbi: 'mbi.pdf',
  uvp: 'uvp.pdf',
  gap: 'gap.pdf',
  ppm: 'ppm.pdf',
  ceramic: 'ceramic.pdf',
  windshield: 'windshield.pdf',
  theft: 'theft.pdf',
  gps: 'gps.pdf'
};

var RETIRED_PROTECTION_IDS_ = {
  warranty: true,
  key: true,
  roadhazard: true,
  paint: true
};

function defaultProtectionProducts_() {
  return [
    {
      id: 'mbi', category: 'protection', name: 'Mechanical Breakdown Insurance',
      provider: 'Louisiana Dealer Services',
      description: 'Covers electronic, electrical, and mechanical parts if they fail. Deductible options plus rental or rideshare help. Optional — not required to finance.',
      price: 2848, taxable: false, defaultOn: false, sort: 10
    },
    {
      id: 'uvp', category: 'protection', name: 'Ultimate Vehicle Protection',
      provider: 'Safe-Guard',
      description: 'Packages tire & wheel, dent, and key protection so road-hazard and everyday damage is covered. No typical deductible — see brochure for terms.',
      price: 1995, taxable: false, defaultOn: false, sort: 20
    },
    {
      id: 'gap', category: 'protection', name: 'Guaranteed Asset Protection (GAP)',
      provider: 'Safe-Guard',
      description: 'If the vehicle is a total loss, GAP may waive the difference between the insurance payout and the remaining loan or lease balance.',
      price: 895, taxable: false, defaultOn: false, sort: 30
    },
    {
      id: 'ppm', category: 'protection', name: 'Pre-Paid Maintenance',
      provider: 'Procarma',
      description: 'Lock in oil changes, tire rotations, brake inspections, and more at a fixed price. Track visits in the Procarma app.',
      price: 1295, taxable: false, defaultOn: false, sort: 40
    },
    {
      id: 'ceramic', category: 'protection', name: 'Safe-Shield Ceramic',
      provider: 'Safe-Guard',
      description: 'Interior and exterior appearance protection designed to keep the vehicle looking new, with covered-repair rental assistance.',
      price: 795, taxable: false, defaultOn: false, sort: 50
    },
    {
      id: 'windshield', category: 'protection', name: 'Windshield Protection',
      provider: 'Safe-Guard',
      description: 'Unlimited repair of front-windshield chips and cracks from road debris. Optional one-time replacement — see brochure for terms.',
      price: 759, taxable: false, defaultOn: false, sort: 60
    },
    {
      id: 'theft', category: 'protection', name: 'Vehicle Theft Protection',
      provider: 'Safe-Guard',
      description: 'If the vehicle is stolen, helps cover deductible, fees, and extra replacement costs that primary insurance often leaves unpaid.',
      price: 695, taxable: false, defaultOn: false, sort: 70
    },
    {
      id: 'gps', category: 'protection', name: 'GPS - Vehicle Locator',
      provider: 'Stargard',
      description: '24/7 stolen-vehicle recovery with law enforcement, live location in the app, custom alerts, and no subscription fees.',
      price: 995, taxable: false, defaultOn: false, sort: 80
    }
  ];
}

function defaultCatalogRows_() {
  return defaultProtectionProducts_().map(function (p) {
    return catalogProductToRow_(p);
  });
}

function catalogProductToRow_(p) {
  return [
    p.id,
    p.category || 'protection',
    p.name,
    p.description || '',
    p.price == null ? 0 : p.price,
    p.taxable ? 'TRUE' : 'FALSE',
    p.defaultOn ? 'TRUE' : 'FALSE',
    p.sort || 0,
    p.active === false ? 'FALSE' : 'TRUE',
    p.brochureUrl || '',
    p.provider || ''
  ];
}

function headerIndexMap_(row) {
  var map = {};
  for (var i = 0; i < row.length; i++) {
    var key = String(row[i] || '').trim().toLowerCase();
    if (key) map[key] = i;
  }
  return map;
}

function ensureCatalogSheet_(ss) {
  var sheet = ss.getSheetByName('QUOTE_CATALOG');
  if (!sheet) {
    sheet = ss.insertSheet('QUOTE_CATALOG');
    sheet.getRange(1, 1, 1, CATALOG_HEADERS_.length).setValues([CATALOG_HEADERS_]);
    headerStyle_(sheet, CATALOG_HEADERS_.length);
    var rows = defaultCatalogRows_();
    sheet.getRange(2, 1, rows.length, CATALOG_HEADERS_.length).setValues(rows);
    applyCatalogSheetLayout_(sheet);
  } else {
    migrateCatalogSheet_(sheet);
  }
}

function applyCatalogSheetLayout_(sheet) {
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 460);
  sheet.setColumnWidth(10, 280);
  sheet.setColumnWidth(11, 200);
  sheet.getRange(1, 2, 1, 1).setNote('protection or accessory');
  sheet.getRange(1, 5, 1, 1).setNote('Selling price. Change this cell anytime — no code deploy.');
  sheet.getRange(1, 6, 1, 1).setNote('FALSE for typical F&I (not sales-taxed)');
  sheet.getRange(1, 10, 1, 1).setNote('Paste a Drive “anyone with the link” URL, or run GEAUX Desk → Publish quote brochures.');
}

function migrateCatalogSheet_(sheet) {
  var range = sheet.getDataRange();
  var data = range.getValues();
  if (!data.length) {
    sheet.getRange(1, 1, 1, CATALOG_HEADERS_.length).setValues([CATALOG_HEADERS_]);
    headerStyle_(sheet, CATALOG_HEADERS_.length);
    data = [CATALOG_HEADERS_.slice()];
  }
  var headers = data[0].map(function (h) { return String(h || '').trim(); });
  var changedHeaders = false;
  for (var h = 0; h < CATALOG_HEADERS_.length; h++) {
    var needed = CATALOG_HEADERS_[h];
    var found = false;
    for (var c = 0; c < headers.length; c++) {
      if (headers[c].toLowerCase() === needed.toLowerCase()) { found = true; break; }
    }
    if (!found) {
      headers.push(needed);
      changedHeaders = true;
    }
  }
  if (changedHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    headerStyle_(sheet, headers.length);
  }
  applyCatalogSheetLayout_(sheet);

  var col = headerIndexMap_(headers);
  var byId = {};
  for (var i = 1; i < data.length; i++) {
    var existingId = String(data[i][col.id] || '').trim();
    if (existingId) byId[existingId] = i + 1;
  }

  var products = defaultProtectionProducts_();
  for (var p = 0; p < products.length; p++) {
    var item = products[p];
    var rowNumber = byId[item.id];
    if (rowNumber) {
      sheet.getRange(rowNumber, col.category + 1).setValue(item.category);
      sheet.getRange(rowNumber, col.name + 1).setValue(item.name);
      sheet.getRange(rowNumber, col.description + 1).setValue(item.description);
      if (col.provider != null) sheet.getRange(rowNumber, col.provider + 1).setValue(item.provider);
      if (col.active != null) sheet.getRange(rowNumber, col.active + 1).setValue(true);
    } else {
      sheet.appendRow(catalogProductToRow_(item));
    }
  }

  data = sheet.getDataRange().getValues();
  headers = data[0].map(function (h) { return String(h || '').trim(); });
  col = headerIndexMap_(headers);
  for (var r = 1; r < data.length; r++) {
    var id = String(data[r][col.id] || '').trim();
    var category = String(data[r][col.category] || '').trim().toLowerCase();
    if (category === 'protection' && RETIRED_PROTECTION_IDS_[id] && col.active != null) {
      sheet.getRange(r + 1, col.active + 1).setValue(false);
    }
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
  var col = headerIndexMap_(data[0] || []);
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(col.id != null ? data[i][col.id] : data[i][0] || '').trim();
    if (!id) continue;
    items.push({
      id: id,
      category: String(col.category != null ? data[i][col.category] : data[i][1] || 'accessory').trim().toLowerCase(),
      name: String(col.name != null ? data[i][col.name] : data[i][2] || id).trim(),
      description: String(col.description != null ? data[i][col.description] : data[i][3] || '').trim(),
      price: toNumber_(col.price != null ? data[i][col.price] : data[i][4]),
      taxable: parseBoolCell_(col.taxable != null ? data[i][col.taxable] : data[i][5], true),
      defaultOn: parseBoolCell_(col.defaulton != null ? data[i][col.defaulton] : data[i][6], false),
      sort: toNumber_(col.sort != null ? data[i][col.sort] : data[i][7]),
      active: parseBoolCell_(col.active != null ? data[i][col.active] : data[i][8], true),
      brochureUrl: String(col.brochureurl != null ? data[i][col.brochureurl] : '').trim(),
      provider: String(col.provider != null ? data[i][col.provider] : '').trim()
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

function getOrCreateBrochureFolder_() {
  var ss = getActiveSs_();
  var parents = [];
  try {
    var file = DriveApp.getFileById(ss.getId());
    parents = file.getParents();
  } catch (e) {
    parents = { hasNext: function () { return false; } };
  }
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var existing = parent.getFoldersByName(BROCHURE_FOLDER_NAME_);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(BROCHURE_FOLDER_NAME_);
}

function findBrochureFile_(folder, filename) {
  var files = folder.getFilesByName(filename);
  if (files.hasNext()) return files.next();
  var all = folder.getFiles();
  var want = String(filename).toLowerCase();
  while (all.hasNext()) {
    var f = all.next();
    if (String(f.getName() || '').toLowerCase() === want) return f;
  }
  return null;
}

function setCatalogBrochureUrl_(id, url) {
  var sheet = getActiveSs_().getSheetByName('QUOTE_CATALOG');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var col = headerIndexMap_(data[0] || []);
  if (col.id == null || col.brochureurl == null) return;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col.id] || '').trim() === id) {
      sheet.getRange(i + 1, col.brochureurl + 1).setValue(url);
      return;
    }
  }
}

/**
 * Copies sharing links for PDFs in the "GEAUX Quote Brochures" Drive folder
 * into QUOTE_CATALOG BrochureUrl. Prices stay on the sheet.
 */
function publishQuoteBrochures() {
  ensureConfigSheets();
  var folder = getOrCreateBrochureFolder_();
  var updated = [];
  var missing = [];
  for (var id in BROCHURE_FILES_) {
    if (!BROCHURE_FILES_.hasOwnProperty(id)) continue;
    var filename = BROCHURE_FILES_[id];
    var file = findBrochureFile_(folder, filename);
    if (!file) {
      missing.push(filename);
      continue;
    }
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    var url = 'https://drive.google.com/file/d/' + file.getId() + '/view';
    setCatalogBrochureUrl_(id, url);
    updated.push(filename);
  }
  var msg = 'Brochure folder:\n' + folder.getUrl() + '\n\n';
  if (updated.length) msg += 'Linked: ' + updated.join(', ') + '\n';
  if (missing.length) {
    msg += 'Missing (copy from the repo brochures/ folder): ' + missing.join(', ') + '\n';
  }
  msg += '\nEdit selling prices on the QUOTE_CATALOG Price column. No code change needed.';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    console.log(msg);
  }
  return { folderUrl: folder.getUrl(), updated: updated, missing: missing };
}
