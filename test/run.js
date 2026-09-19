#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const ctx = { console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, String: String, Number: Number, Array: Array, parseFloat: parseFloat, parseInt: parseInt, isNaN: isNaN };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'Pricing.gs'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'HtmlUtil.gs'), 'utf8'), ctx);

const failures = [];
function test(name, fn) {
  try { fn(); console.log('  PASS  ' + name); }
  catch (e) { failures.push(name + ': ' + e.message); console.log('  FAIL  ' + name + ' — ' + e.message); }
}

console.log('\nPricing + HTML util tests\n');

const sampleDesk = {
  date: '2026-09-18',
  marketValue: 50000,
  savings: 2000,
  rebate1: 1000,
  rebate2: 0, rebate3: 0, rebate4: 0, rebate5: 0,
  autoguardPrice: 495,
  acc1Price: 300,
  acc2Price: 0,
  acc3Price: 0,
  tradeAllowance: 10000,
  balanceToRelease: 2000,
  cashDeposit: 1000,
  creditYN: 'Y',
  taxRate: 10,
  rate: 12,
  term: 12,
  daysToFirst: 45,
  docFee: 400,
  titleFee: 100,
  licenseFee: 0, recordationFee: 0, tempTag: 0, wasteTire: 0,
  stateInspection: 0, handlingFee: 0, notaryFee: 0, convenienceFee: 0,
  msrpCost: 40000,
  autoguardCost: 100,
  acc1Cost: 50, acc2Cost: 0, acc3Cost: 0,
  tradeAcv: 9000,
  autoguardLabel: 'AUTOGUARD',
  acc1Label: 'WINDOW TINT',
  ssn: '111-22-3333',
  dob: '1990-01-01',
  msrpCostKeep: 1,
  customerName: 'Test Buyer',
  stockNumber: 'ABC123'
};

test('normalizeDeskData maps stockNumber and keeps SSN off public payload separately', function() {
  const n = ctx.normalizeDeskData(sampleDesk);
  assert.strictEqual(n.stockNum, 'ABC123');
});

test('AMV includes desk products (matches desking waterfall)', function() {
  const c = ctx.calculateDeal(sampleDesk, {});
  // 50000 - 2000 - 1000 + 495 + 300 = 47795
  assert.strictEqual(c.adjMV, 47795);
});

test('Sales price is after trade, before down payment', function() {
  const c = ctx.calculateDeal(sampleDesk, {});
  // 47795 - 10000 + 2000 = 39795
  assert.strictEqual(c.salesPrice, 39795);
});

test('TTL total includes tax+fees and financed subtracts down once', function() {
  const c = ctx.calculateDeal(sampleDesk, {});
  // taxBase = adjMV = 47795, rate 10%, credit Y: tax = 4779.50 - 1000 = 3779.50
  assert.strictEqual(c.tax, 3779.5);
  assert.strictEqual(c.fees, 500);
  assert.strictEqual(c.totalPlusTtl, 39795 + 3779.5 + 500);
  assert.strictEqual(c.totalFinanced, c.totalPlusTtl - 1000);
});

test('Unknown catalog ids are ignored (client cannot invent products)', function() {
  const catalog = [{ id: 'gap', name: 'GAP', price: 895, taxable: false, active: true }];
  const c = ctx.calculateDeal(sampleDesk, {
    protectionIds: ['gap', 'bogus-hacker-product'],
    protectionCatalog: catalog
  });
  assert.strictEqual(c.protectionTotal, 895);
  assert.strictEqual(c.protectionItems.length, 1);
});

test('Non-taxable F&I does not inflate sales tax', function() {
  const catalog = [{ id: 'gap', name: 'GAP', price: 1000, taxable: false, active: true }];
  const base = ctx.calculateDeal(sampleDesk, {});
  const withGap = ctx.calculateDeal(sampleDesk, {
    protectionIds: ['gap'],
    protectionCatalog: catalog
  });
  assert.strictEqual(withGap.tax, base.tax);
  assert.strictEqual(withGap.salesPrice, base.salesPrice + 1000);
});

test('redactDeskForCustomer strips SSN, DOB, and costs', function() {
  const pub = ctx.redactDeskForCustomer(sampleDesk);
  assert.strictEqual(pub.ssn, undefined);
  assert.strictEqual(pub.dob, undefined);
  assert.strictEqual(pub.msrpCost, undefined);
  assert.strictEqual(pub.autoguardCost, undefined);
  assert.ok(pub.marketValue);
  assert.ok(pub.stockNum || pub.stockNumber === undefined);
  assert.strictEqual(pub.stockNum, 'ABC123');
});

test('filterCatalogAgainstDesk hides WINDOW TINT when it is already ACC 1', function() {
  const catalog = [
    { id: 'tint', name: 'WINDOW TINT', price: 395, active: true },
    { id: 'gap', name: 'GAP Insurance', price: 895, active: true }
  ];
  const filtered = ctx.filterCatalogAgainstDesk(catalog, sampleDesk);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, 'gap');
});

test('local date parse does not shift YYYY-MM-DD', function() {
  const d = ctx.parseLocalDate_('2026-09-18');
  assert.strictEqual(ctx.formatUsDate_(d), '9/18/2026');
  assert.strictEqual(ctx.formatIsoDate_(d), '2026-09-18');
});

test('injectJson replaces placeholder with script-safe JSON', function() {
  const html = "const DESK = __DESK_DATA_PLACEHOLDER__;";
  const out = ctx.injectJson_(html, '__DESK_DATA_PLACEHOLDER__', { customerName: '</script>x', n: 1 });
  assert.ok(out.indexOf('\\u003c/script>') !== -1);
  assert.ok(out.indexOf('__DESK_DATA_PLACEHOLDER__') === -1);
  const parsed = Function('return ' + out.replace('const DESK = ', ''))();
  assert.strictEqual(parsed.n, 1);
});

test('escapeHtml encodes markup', function() {
  assert.strictEqual(ctx.escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});

test('quote HTML has placeholders and no hardcoded demo PII', function() {
  const html = fs.readFileSync(path.join(root, 'customerQuote.html'), 'utf8');
  assert.ok(html.indexOf('__DESK_DATA_PLACEHOLDER__') !== -1);
  assert.ok(html.indexOf('__QUOTE_CONFIG_PLACEHOLDER__') !== -1);
  assert.ok(html.indexOf('KERRY MUMPHREY') === -1);
  assert.ok(html.indexOf('WALLS CEMETARY') === -1);
  assert.ok(html.indexOf('warrantyCost2') === -1);
  assert.ok(html.indexOf('btnManualOverride') === -1);
  assert.ok(html.indexOf('const PROTECTION_PACKAGES') === -1);
  assert.ok(html.indexOf('const RATE_MATRIX') === -1);
});

test('desking dialog injects initial dropdown data', function() {
  const html = fs.readFileSync(path.join(root, 'deskingDialog.html'), 'utf8');
  assert.ok(html.indexOf('__DESK_INITIAL_PLACEHOLDER__') !== -1);
  assert.ok(html.indexOf('applyInitialData') !== -1);
  const desk = fs.readFileSync(path.join(root, 'Desking.gs'), 'utf8');
  assert.ok(desk.indexOf("injectJson_(raw, '__DESK_INITIAL_PLACEHOLDER__'") !== -1);
  const cfg = fs.readFileSync(path.join(root, 'Config.gs'), 'utf8');
  assert.ok(cfg.indexOf('GEAUX_CONFIG_SCHEMA') !== -1);
  assert.ok(cfg.indexOf('_configSheetsReady_') !== -1);
  const injected = ctx.injectJson_(html, '__DESK_INITIAL_PLACEHOLDER__', { salespeople: ['Jane'], managers: ['DAVID'] });
  assert.ok(injected.indexOf('__DESK_INITIAL_PLACEHOLDER__') === -1);
  assert.ok(injected.indexOf('Jane') !== -1);
});

test('desking dialog does not use innerHTML for names', function() {
  const html = fs.readFileSync(path.join(root, 'deskingDialog.html'), 'utf8');
  assert.ok(html.indexOf('Total Plus T.T.L.') !== -1);
  assert.ok(html.indexOf('quotePreselectedProtection') !== -1);
  assert.ok(html.indexOf('addOption') !== -1);
});

test('print template does not include SSN', function() {
  const html = fs.readFileSync(path.join(root, 'deskPrint.html'), 'utf8');
  assert.ok(html.indexOf('p_ssn') === -1);
  assert.ok(html.toLowerCase().indexOf('>ssn<') === -1);
});

test('quote catalog defaults are dealer F&I products with brochure column', function() {
  const src = fs.readFileSync(path.join(root, 'Config.gs'), 'utf8');
  assert.ok(src.indexOf('Mechanical Breakdown Insurance') !== -1);
  assert.ok(src.indexOf('Safe-Shield Ceramic') !== -1);
  assert.ok(src.indexOf('GPS - Vehicle Locator') !== -1);
  assert.ok(src.indexOf('BrochureUrl') !== -1);
  assert.ok(src.indexOf("name: 'Extended Warranty'") === -1);
  const html = fs.readFileSync(path.join(root, 'customerQuote.html'), 'utf8');
  assert.ok(html.indexOf('pkg-brochure') !== -1);
  assert.ok(html.indexOf('Optional Coverages') !== -1);
  ['mbi', 'uvp', 'gap', 'ppm', 'ceramic', 'windshield', 'theft', 'gps'].forEach(function(id) {
    assert.ok(fs.existsSync(path.join(root, 'brochures', id + '.pdf')), 'missing brochure ' + id);
  });
});

test('config defaults store city to LaPlace, not Gonzales', function() {
  const src = fs.readFileSync(path.join(root, 'Config.gs'), 'utf8');
  assert.ok(src.indexOf("DEFAULT_STORE_CITY_ = 'LaPlace, LA'") !== -1);
  assert.ok(src.indexOf('Gonzales, Louisiana') === -1);
  const preview = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
  assert.ok(preview.indexOf("storeCity: 'LaPlace, LA'") !== -1);
});

test('print template uses GEAUX Chevrolet logo, not Supreme wordmark', function() {
  const html = fs.readFileSync(path.join(root, 'deskPrint.html'), 'utf8');
  assert.ok(html.indexOf('alt="GEAUX Chevrolet"') !== -1);
  assert.ok(html.indexOf('data:image/jpeg;base64') !== -1);
  assert.ok(html.indexOf('brand-logo') !== -1);
  assert.ok(html.indexOf('Supreme') === -1);
  assert.ok(html.indexOf('AUTOMOTIVE GROUP') === -1);
  assert.ok(html.indexOf('logo-GEAUX') === -1);
  assert.ok(fs.existsSync(path.join(root, 'assets/geaux-chevrolet-logo.jpg')));
});

test('DMS aliases: taxCreditForTrade YES → creditYN Y', function() {
  const c = ctx.calculateDeal({
    marketValue: 10000, taxRate: 10, taxCreditForTrade: 'YES', tradeAllowance: 2000,
    term: 12, rate: 0
  }, {});
  // tax = 1000 - 200 = 800
  assert.strictEqual(c.tax, 800);
});

vm.runInContext(fs.readFileSync(path.join(root, 'Config.gs'), 'utf8'), ctx);

test('manager names are not hardcoded gates for save/print/quote', function() {
  const cfg = fs.readFileSync(path.join(root, 'Config.gs'), 'utf8');
  const desk = fs.readFileSync(path.join(root, 'Desking.gs'), 'utf8');
  const quote = fs.readFileSync(path.join(root, 'CustomerQuote.gs'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'deskingDialog.html'), 'utf8');
  assert.ok(cfg.indexOf("['KERRY'") === -1);
  assert.ok(cfg.indexOf("['DAVID'") === -1);
  assert.ok(cfg.indexOf("['KEITH'") === -1);
  assert.ok(cfg.indexOf("['STEVE'") === -1);
  assert.ok(cfg.indexOf('requireStagingRow_') === -1);
  assert.ok(cfg.indexOf('resolveStagingRow_') !== -1);
  assert.ok(desk.indexOf('requireStagingRow_') === -1);
  assert.ok(desk.indexOf('resolveStagingRow_') !== -1);
  assert.ok(quote.indexOf('requireStagingRow_') === -1);
  assert.ok(quote.indexOf('resolveStagingRow_') !== -1);
  assert.ok(html.indexOf('requireManager') === -1);
  assert.ok(html.indexOf('Please select a Manager first') === -1);
  assert.ok(html.indexOf('function saveDesk()') !== -1);
  assert.ok(html.indexOf('function printPresentation()') !== -1);
  assert.ok(html.indexOf('function openCustomerQuote()') !== -1);
});

test('customer quote links never use YOUR_DEPLOYMENT_ID placeholder', function() {
  const quote = fs.readFileSync(path.join(root, 'CustomerQuote.gs'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'customerQuote.html'), 'utf8');
  const deskHtml = fs.readFileSync(path.join(root, 'deskingDialog.html'), 'utf8');
  assert.ok(quote.indexOf("return 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'") === -1);
  assert.ok(quote.indexOf("setProperty('WEBAPP_URL', YOUR_WEBAPP_URL)") === -1);
  assert.ok(quote.indexOf("var YOUR_WEBAPP_URL") === -1);
  assert.ok(quote.indexOf('buildQuoteShareLink_') !== -1);
  assert.ok(quote.indexOf('function emailCustomerQuote') !== -1);
  assert.ok(quote.indexOf('function buildCustomerQuoteEmail_') !== -1);
  assert.ok(quote.indexOf('showCopyableUrlDialog_') !== -1);
  assert.ok(quote.indexOf('no web link') !== -1);
  assert.ok(deskHtml.indexOf('EMAIL QUOTE') !== -1);
  assert.ok(quote.indexOf('ScriptApp.getService') !== -1);
  assert.ok(html.indexOf('isLiveWebAppUrl') !== -1);
  assert.ok(deskHtml.indexOf('EMAIL QUOTE') !== -1);
  assert.ok(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8').indexOf('Save Web App URL') !== -1);
});

test('optional MANAGER_STAGING match still routes; unmatched/blank uses row 1', function() {
  const list = [{ match: 'PAT', row: 3 }];
  assert.strictEqual(ctx.matchStagingRow_('Pat Nguyen', list, 1), 3);
  assert.strictEqual(ctx.matchStagingRow_('pat', list, 1), 3);
  assert.strictEqual(ctx.matchStagingRow_('Alex Rivera', list, 1), 1);
  assert.strictEqual(ctx.matchStagingRow_('', list, 1), 1);
  assert.strictEqual(ctx.matchStagingRow_('Alex Rivera', list, 0), 0);
  assert.strictEqual(ctx.matchStagingRow_('', [], 1), 1);
  assert.strictEqual(ctx.DEFAULT_STAGING_ROW_, 1);

  const orig = ctx.getManagerStagingRows;
  ctx.getManagerStagingRows = function() { return list; };
  try {
    assert.strictEqual(ctx.resolveStagingRow_('Pat Nguyen'), 3);
    assert.strictEqual(ctx.resolveStagingRow_('Unknown Manager'), 1);
    assert.strictEqual(ctx.resolveStagingRow_(''), 1);
    assert.strictEqual(ctx.getStagingRow_('Unknown Manager'), 0);
    assert.strictEqual(ctx.getStagingRow_(''), 0);
  } finally {
    ctx.getManagerStagingRows = orig;
  }
});

vm.runInContext(fs.readFileSync(path.join(root, 'Desking.gs'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'CustomerQuote.gs'), 'utf8'), ctx);

test('customer quote email tells them to open the attachment, not a web link', function() {
  const mail = ctx.buildCustomerQuoteEmail_({
    storeName: 'GEAUX Chevrolet',
    storeCity: 'LaPlace, LA',
    storePhone: '(225) 644-8411'
  }, {
    customerName: 'Alex Customer',
    year: '2026',
    make: 'CHEV',
    model: 'TRAVERSE',
    salesperson: 'Jane'
  }, '1102');
  assert.strictEqual(mail.fileName, 'Your-GEAUX-Chevrolet-Quote-1102.html');
  assert.ok(mail.subject.indexOf(mail.fileName) !== -1);
  assert.ok(mail.body.indexOf('no web link') !== -1);
  assert.ok(mail.body.indexOf('paperclip') !== -1);
  assert.ok(mail.htmlBody.indexOf('paperclip') !== -1);
  assert.ok(mail.htmlBody.indexOf('Your quote is this attached file') !== -1);
  assert.ok(mail.body.indexOf('script.google.com') === -1);
  assert.ok(mail.htmlBody.indexOf('script.google.com') === -1);
  assert.ok(mail.body.indexOf('Hi Alex') !== -1);
});

test('placeholder web app URLs cannot become customer links', function() {
  assert.strictEqual(ctx.isUsableWebAppUrl_('https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'), false);
  assert.strictEqual(ctx.isUsableWebAppUrl_('https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec'), false);
  assert.strictEqual(ctx.isUsableWebAppUrl_(''), false);
  assert.strictEqual(ctx.isUsableWebAppUrl_('https://example.invalid/exec'), false);
  assert.strictEqual(ctx.isUsableWebAppUrl_('https://script.google.com/macros/s/AKfycbxLiveId123/exec'), true);
  assert.strictEqual(
    ctx.normalizeWebAppUrl_('https://script.google.com/macros/s/AKfycbyJXHt_lfpsgxCqriMqek_dYroDLruTAHu6DlrplO3AKk2Qe'),
    'https://script.google.com/macros/s/AKfycbyJXHt_lfpsgxCqriMqek_dYroDLruTAHu6DlrplO3AKk2Qe/exec'
  );
  assert.strictEqual(
    ctx.buildQuoteShareLink_('QT_d4b451c931c44d', 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'),
    ''
  );
  assert.strictEqual(
    ctx.buildQuoteShareLink_('QT_d4b451c931c44d', 'https://script.google.com/macros/s/AKfycbyJXHt_lfpsgxCqriMqek_dYroDLruTAHu6DlrplO3AKk2Qe'),
    'https://script.google.com/macros/s/AKfycbyJXHt_lfpsgxCqriMqek_dYroDLruTAHu6DlrplO3AKk2Qe/exec?token=QT_d4b451c931c44d'
  );
  assert.strictEqual(
    ctx.buildQuoteShareLink_('QT_d4b451c931c44d', 'https://script.google.com/macros/s/AKfycbxLiveId123/dev'),
    'https://script.google.com/macros/s/AKfycbxLiveId123/exec?token=QT_d4b451c931c44d'
  );
  assert.strictEqual(
    ctx.normalizeWebAppUrl_('https://script.google.com/a/macros/geauxautomotive.com/s/AKfycbxLiveId123/exec'),
    'https://script.google.com/macros/s/AKfycbxLiveId123/exec'
  );
});

test('stored placeholder WEBAPP_URL is ignored in favor of the live deployment', function() {
  const orig = {
    PropertiesService: ctx.PropertiesService,
    ScriptApp: ctx.ScriptApp,
    getConfigMap: ctx.getConfigMap,
    rememberWebAppUrl_: ctx.rememberWebAppUrl_
  };
  ctx.PropertiesService = {
    getScriptProperties: function() {
      return {
        getProperty: function() { return 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'; },
        setProperty: function() {}
      };
    }
  };
  ctx.ScriptApp = {
    getService: function() {
      return { getUrl: function() { return 'https://script.google.com/macros/s/AKfycbxLiveId123/exec'; } };
    }
  };
  ctx.getConfigMap = function() { return { webAppUrl: '' }; };
  ctx.rememberWebAppUrl_ = function() {};
  try {
    assert.strictEqual(ctx.getWebAppUrl_(), 'https://script.google.com/macros/s/AKfycbxLiveId123/exec');
  } finally {
    Object.keys(orig).forEach(function(k) { ctx[k] = orig[k]; });
  }
});

test('save, print, and quote succeed with unmatched or blank manager names', function() {
  const writes = [];
  const orig = {
    ensureConfigSheets: ctx.ensureConfigSheets,
    withSheetLock_: ctx.withSheetLock_,
    getManagerStagingRows: ctx.getManagerStagingRows,
    getDeskSheet_: ctx.getDeskSheet_,
    storeQuoteDeal_: ctx.storeQuoteDeal_,
    getWebAppUrl_: ctx.getWebAppUrl_,
    buildQuoteHtml_: ctx.buildQuoteHtml_,
    snapshotQuoteConfig_: ctx.snapshotQuoteConfig_,
    HtmlService: ctx.HtmlService
  };
  ctx.ensureConfigSheets = function() {};
  ctx.withSheetLock_ = function(fn) { return fn(); };
  ctx.getManagerStagingRows = function() { return []; };
  ctx.getDeskSheet_ = function() {
    return {
      getLastRow: function() { return 6; },
      getRange: function(row) {
        return {
          getValues: function() { return [['1001']]; },
          setValues: function(vals) {
            writes.push({ row: row, deal: vals[0][58] });
            return this;
          }
        };
      }
    };
  };
  ctx.storeQuoteDeal_ = function() { return 'QT_unmatched'; };
  ctx.getWebAppUrl_ = function() { return 'https://script.google.com/macros/s/AKfycbxTest/exec'; };
  ctx.snapshotQuoteConfig_ = function() { return { settings: {}, protection: [], accessories: [] }; };
  ctx.buildQuoteHtml_ = function() { return '<html>quote-ok</html>'; };
  ctx.HtmlService = {
    createHtmlOutputFromFile: function() {
      return { getContent: function() { return 'PRINT __DESK_DATA_PLACEHOLDER__'; } };
    }
  };

  try {
    const saved = ctx.saveDesk({ manager: 'Alex Rivera', customerName: 'Test Buyer', marketValue: 40000 }, false);
    assert.strictEqual(saved.success, true);
    assert.ok(saved.dealNumber);

    const skipped = ctx.saveDesk({ manager: '', customerName: 'Live Type' }, true);
    assert.strictEqual(skipped.message.indexOf('Staging skipped') !== -1, true);

    const stagedUnknown = ctx.saveDesk({ manager: 'Jordan Lee', customerName: 'Live Type' }, true);
    assert.strictEqual(stagedUnknown.success, true);

    const printed = ctx.getDeskPrintHtmlWithSave({ manager: '', customerName: 'No Manager', marketValue: 25000 });
    assert.ok(printed.htmlStr.indexOf('No Manager') !== -1);
    assert.ok(printed.dealNumber);

    const quoted = ctx.getCustomerQuoteHtmlWithSave({ manager: 'Not In Staging Sheet', customerName: 'Quote Buyer' });
    assert.strictEqual(quoted.htmlStr, '<html>quote-ok</html>');
    assert.ok(quoted.dealNumber);
    assert.ok(quoted.shareLink.indexOf('QT_unmatched') !== -1);

    const stagingWrites = writes.filter(function(w) { return w.row === 1; });
    assert.ok(stagingWrites.length >= 3, 'unmatched/blank managers still write DESKDATA row 1');
  } finally {
    Object.keys(orig).forEach(function(k) { ctx[k] = orig[k]; });
  }
});

// Build preview HTML
const quoteTpl = fs.readFileSync(path.join(root, 'customerQuote.html'), 'utf8');
const previewDesk = ctx.redactDeskForCustomer({
  date: '2026-09-18',
  salesperson: 'Jane Sales',
  manager: 'DAVID BARRIENT',
  customerName: 'Alex Customer',
  dealNumber: '1102',
  stockNum: 'SC1001',
  newUsed: 'NEW',
  year: '2026',
  make: 'CHEV',
  model: 'TRAVERSE',
  color: 'BLACK',
  mileage: '12',
  vin: '1GNEVJKS0TJ000000',
  marketValue: 53620,
  savings: 4000,
  rebate1: 2000,
  rebate1Label: 'BONUS CASH',
  autoguardPrice: 495,
  autoguardLabel: 'AUTOGUARD',
  acc1Price: 299,
  acc1Label: 'WINDOW TINT',
  tradeAllowance: 15000,
  tradePayoff: 8000,
  balanceToRelease: 8000,
  cashDeposit: 1000,
  creditYN: 'Y',
  taxRate: 9.5,
  rate: 6.19,
  term: 72,
  daysToFirst: 45,
  docFee: 436,
  titleFee: 68.50,
  licenseFee: 70,
  recordationFee: 15,
  tempTag: 4,
  wasteTire: 11.25,
  notaryFee: 15,
  convenienceFee: 26,
  handlingFee: 8
});
previewDesk._isManagerPreview = true;
previewDesk._shareLink = 'https://example.invalid/quote?token=demo';
previewDesk._token = 'demo';

const previewConfig = {
  settings: {
    storeName: 'GEAUX Chevrolet',
    storeCity: 'LaPlace, LA',
    storePhone: '(225) 644-8411',
    defaultTerm: 72,
    allowTermChange: true,
    defaultCreditTier: 'a1',
    useOddDaysOnQuote: true
  },
  protection: [
    { id: 'mbi', name: 'Mechanical Breakdown Insurance', provider: 'Louisiana Dealer Services', description: 'Covers electronic, electrical, and mechanical parts if they fail.', price: 2848, taxable: false, brochureUrl: '/brochures/mbi.pdf' },
    { id: 'uvp', name: 'Ultimate Vehicle Protection', provider: 'Safe-Guard', description: 'Tire & wheel, dent, and key protection packaged together.', price: 1995, taxable: false, brochureUrl: '/brochures/uvp.pdf' },
    { id: 'gap', name: 'Guaranteed Asset Protection (GAP)', provider: 'Safe-Guard', description: 'May waive the gap between insurance payout and the remaining balance after a total loss.', price: 895, taxable: false, brochureUrl: '/brochures/gap.pdf' },
    { id: 'ppm', name: 'Pre-Paid Maintenance', provider: 'Procarma', description: 'Prepaid oil changes, tire rotations, and inspections at a fixed price.', price: 1295, taxable: false, brochureUrl: '/brochures/ppm.pdf' },
    { id: 'ceramic', name: 'Safe-Shield Ceramic', provider: 'Safe-Guard', description: 'Interior and exterior appearance protection to keep the vehicle looking new.', price: 795, taxable: false, brochureUrl: '/brochures/ceramic.pdf' },
    { id: 'windshield', name: 'Windshield Protection', provider: 'Safe-Guard', description: 'Unlimited repair of front-windshield chips and cracks from road debris.', price: 759, taxable: false, brochureUrl: '/brochures/windshield.pdf' },
    { id: 'theft', name: 'Vehicle Theft Protection', provider: 'Safe-Guard', description: 'Helps cover deductible and extra costs if the vehicle is stolen.', price: 695, taxable: false, brochureUrl: '/brochures/theft.pdf' },
    { id: 'gps', name: 'GPS - Vehicle Locator', provider: 'Stargard', description: '24/7 stolen-vehicle recovery and live location with no subscription fees.', price: 995, taxable: false, brochureUrl: '/brochures/gps.pdf' }
  ],
  accessories: [],
  rates: {
    '60': { a1: 5.94, a2: 6.19, a3: 8.59, b1: 12.64, b2: 14.84, b3: 16.89 },
    '72': { a1: 6.19, a2: 6.44, a3: 8.99, b1: 13.04, b2: 15.15, b3: 17.69 },
    '84': { a1: 6.34, a2: 6.59, a3: 9.14, b1: null, b2: null, b3: null }
  },
  tiers: [
    { key: 'a1', label: 'Excellent Credit — A1', ficoRange: 'FICO 750+' },
    { key: 'a2', label: 'Very Good — A2', ficoRange: 'FICO 690–749' },
    { key: 'b1', label: 'Fair Credit — B1', ficoRange: 'FICO 620–649' }
  ],
  preselectedProtection: [],
  preselectedAccessories: ['flrmats']
};

let preview = ctx.injectJson_(quoteTpl, '__DESK_DATA_PLACEHOLDER__', previewDesk);
preview = ctx.injectJson_(preview, '__QUOTE_CONFIG_PLACEHOLDER__', previewConfig);
const previewPath = path.join(root, 'test', 'quote-preview.html');
fs.writeFileSync(previewPath, preview);
console.log('\nWrote ' + previewPath);

const printTpl = fs.readFileSync(path.join(root, 'deskPrint.html'), 'utf8');
const printDesk = Object.assign({}, previewDesk, {
  address: '123 Main St',
  ssn: 'SHOULD-NOT-RENDER',
  _calc: ctx.calculateDeal(previewDesk, {}),
  printWithTaxFees: true
});
const printHtml = ctx.injectJson_(printTpl, '__DESK_DATA_PLACEHOLDER__', printDesk);
fs.writeFileSync(path.join(root, 'test', 'print-preview.html'), printHtml);

if (failures.length) {
  console.log('\n' + failures.length + ' failed');
  failures.forEach(function(f) { console.log(' - ' + f); });
  process.exit(1);
}
console.log('\nAll tests passed.\n');
