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

test('LeaseEngine.gs keeps lease tools and has no onOpen', function() {
  const src = fs.readFileSync(path.join(root, 'LeaseEngine.gs'), 'utf8');
  assert.ok(src.indexOf('function openLeaseCalculator') !== -1);
  assert.ok(src.indexOf('function showDashboard') !== -1);
  assert.ok(src.indexOf('function getPersonnelDropdownData') !== -1);
  assert.ok(src.indexOf('function processSaveAndPrint') !== -1);
  assert.ok(src.indexOf('function getGMModelList') !== -1);
  assert.ok(src.indexOf('function saveDealerDefaults') !== -1);
  assert.ok(!/^function\s+onOpen\s*\(/m.test(src));
});

test('Code.gs groups dealer menus under GEAUX TOOLS and GEAUX REPORTS', function() {
  vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), ctx);
  const plan = ctx.geauxMenuBlueprint_();
  assert.strictEqual(plan.toolsTitle, 'GEAUX TOOLS');
  assert.strictEqual(plan.reportsTitle, 'GEAUX REPORTS');
  assert.strictEqual(plan.tools.map(function(g) { return g.title; }).join('|'),
    'Lease Engine|Dealer Bonuses|GEAUX Terminal|Service Manager Report|SLM|GEAUX Desk|Deal Log');
  assert.strictEqual(plan.reports.map(function(g) { return g.title; }).join('|'),
    'Deal Reports|Dealer Tool Kit');
  assert.strictEqual(plan.tools[3].onOpen, 'SMR_onOpen');
  assert.strictEqual(plan.tools[4].onOpen, 'SLM_onOpen');
  assert.ok(plan.tools[5].always);
  assert.ok(plan.tools[6].always);
  assert.strictEqual(plan.tools[6].items[0].fn, 'OPENLOGDEAL');

  const added = [];
  const menus = {};
  function mockMenu(title) {
    const menu = {
      title: title,
      items: [],
      addItem: function(label, fn) { this.items.push({ label: label, fn: fn }); return this; },
      addSeparator: function() { this.items.push({ separator: true }); return this; },
      addSubMenu: function(sub) { this.items.push({ submenu: sub.title, items: sub.items.slice() }); return this; },
      addToUi: function() { added.push(this.title); return this; }
    };
    menus[title] = menu;
    return menu;
  }
  ctx.openLeaseCalculator = function() {};
  ctx.showDashboard = function() {};
  ctx.launchMainTerminal = function() {};
  ctx.launchFinanceTool = function() {};
  ctx.SMR_onOpen = function() {
    ctx.SpreadsheetApp.getUi().createMenu('Service Manager Report').addItem('Open SMR', 'SMR_open').addToUi();
  };
  ctx.SLM_onOpen = function() {
    ctx.SpreadsheetApp.getUi().createMenu('SLM').addItem('Open SLM', 'SLM_open').addToUi();
  };
  ctx.launchDealComparisonReport = function() {};
  ctx.launchTradeDashboardFromMenu = function() {};
  ctx.SCR_showSalesComparisonReport = function() {};
  ctx.GEAUXDealerForm_OpenBridge = function() {};
  ctx.OPEN_DESKING_TOOL = function() {};
  ctx.OPENLOGDEAL = function() {};
  ctx.SpreadsheetApp = {
    getUi: function() {
      return { createMenu: mockMenu };
    }
  };
  ctx.onOpen();
  assert.strictEqual(added.join('|'), 'GEAUX TOOLS|GEAUX REPORTS');
  assert.strictEqual(menus['GEAUX TOOLS'].items.map(function(i) { return i.submenu; }).join('|'),
    'Lease Engine|Dealer Bonuses|GEAUX Terminal|Service Manager Report|SLM|GEAUX Desk|Deal Log');
  assert.strictEqual(menus['GEAUX REPORTS'].items.map(function(i) { return i.submenu; }).join('|'),
    'Deal Reports|Dealer Tool Kit');
  assert.ok(added.indexOf('Service Manager Report') === -1);
  assert.ok(added.indexOf('SLM') === -1);
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

function makeDeskRow_(opts) {
  const row = new Array(73).fill('');
  row[0] = opts.date || '2026-09-18';
  row[3] = opts.customerName || '';
  row[11] = opts.stockNum || '';
  row[15] = opts.year || '2026';
  row[16] = opts.make || 'CHEV';
  row[17] = opts.model || 'TRAVERSE';
  row[58] = opts.dealNumber;
  return row;
}

function makeDeskSheet_(rows) {
  return {
    getLastRow: function() { return rows.length; },
    getLastColumn: function() { return 73; },
    getRange: function(r, c, nRows, nCols) {
      return {
        getValues: function() {
          const out = [];
          for (let i = 0; i < nRows; i++) {
            const src = rows[r - 1 + i] || [];
            const slice = [];
            for (let j = 0; j < nCols; j++) slice.push(src[c - 1 + j] !== undefined ? src[c - 1 + j] : '');
            out.push(slice);
          }
          return out;
        }
      };
    }
  };
}

test('recall and search find DESKDATA deals by deal #, partial name, and stock', function() {
  const origSheet = ctx.getDeskSheet_;
  const rows = [
    makeDeskRow_({ dealNumber: 1102, customerName: 'Maria Barrient', stockNum: 'SC1001' }),
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    makeDeskRow_({ customerName: 'Purchaser Name', dealNumber: 'Deal Number', stockNum: 'Stock #' }),
    makeDeskRow_({ dealNumber: '', customerName: '', stockNum: '' }),
    makeDeskRow_({ dealNumber: 1102.1, customerName: 'Maria Barrient', stockNum: 'SC1001' }),
    makeDeskRow_({ dealNumber: '1103', customerName: 'John Smith', stockNum: 'U2044' }),
    makeDeskRow_({ dealNumber: '1104', customerName: 'Ann Smith', stockNum: 'U3001' })
  ];
  ctx.getDeskSheet_ = function() { return makeDeskSheet_(rows); };
  try {
    const byName = ctx.searchDeals('barri');
    assert.strictEqual(byName.length, 2, 'partial customer matches staging and history versions');
    assert.strictEqual(byName[0].dealNumber, '1102.1');
    assert.strictEqual(byName[1].dealNumber, '1102');

    const byStock = ctx.searchDeals('u20');
    assert.strictEqual(byStock.length, 1);
    assert.strictEqual(byStock[0].customerName, 'John Smith');
    assert.strictEqual(byStock[0].stockNum, 'U2044');

    const byDeal = ctx.searchDeals('1102');
    assert.ok(byDeal.some(function(d) { return d.dealNumber === '1102'; }));
    assert.ok(byDeal.some(function(d) { return d.dealNumber === '1102.1'; }));

    const recalledBase = ctx.recallDesk('1102');
    assert.ok(recalledBase.desk);
    assert.strictEqual(recalledBase.desk.dealNumber, '1102.1', 'base deal # loads latest print version');
    assert.strictEqual(recalledBase.desk.customerName, 'Maria Barrient');

    const recalledExact = ctx.recallDesk('1102.1');
    assert.strictEqual(recalledExact.desk.dealNumber, '1102.1');

    const recalledStock = ctx.recallDesk('SC1001');
    assert.ok(recalledStock.desk);
    assert.strictEqual(recalledStock.desk.stockNum, 'SC1001');

    const recalledName = ctx.recallDesk('john sm');
    assert.ok(recalledName.desk);
    assert.strictEqual(recalledName.desk.dealNumber, '1103');

    const ambiguous = ctx.recallDesk('smith');
    assert.strictEqual(ambiguous.desk, null);
    assert.strictEqual(ambiguous.matches.length, 2);

    assert.strictEqual(ctx.searchDeals('').length, 0);
    assert.strictEqual(ctx.recallDesk('zzz-missing').desk, null);
    assert.strictEqual(ctx.recallDesk('zzz-missing').matches.length, 0);
  } finally {
    ctx.getDeskSheet_ = origSheet;
  }
});

test('Deal Log is a separate GEAUX TOOLS item and does not use onOpen', function() {
  const src = fs.readFileSync(path.join(root, 'DealManager.gs'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'logDealDialog.html'), 'utf8');
  assert.ok(!/^function\s+onOpen\s*\(/m.test(src));
  assert.ok(src.indexOf('function OPENLOGDEAL') !== -1);
  assert.ok(src.indexOf('function logDealFieldAliases_') !== -1);
  assert.ok(src.indexOf('out.paint = out.etch') !== -1);
  assert.ok(src.indexOf('out.spiff2 = out.spiff2b') !== -1);
  assert.ok(src.indexOf('etch:               paintVal') !== -1);
  assert.ok(src.indexOf('sourceRange.copyTo(destRange)') !== -1);
  assert.ok(src.indexOf('var PROTECTED_INDICES = [2,16,25,26,40,50,67,69,71,77,80,82,83,84,85,86,87,88,') !== -1);
  assert.ok(src.indexOf('89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,105,106,107,108,109,110,111,') !== -1);
  assert.ok(src.indexOf('112,113,115,116,117,118,119,120,121,122,124,125,126];') !== -1);
  assert.ok(html.indexOf('d.paint = d.etch') !== -1);
  assert.ok(html.indexOf("d.spiff2 = s2 ? s2.value : ''") !== -1);
  assert.ok(html.indexOf('.clearForm()') !== -1);
  assert.ok(html.indexOf('s.textContent = text') !== -1);
  assert.ok(html.indexOf('etch: d.etch || d.paint') !== -1);
  assert.ok(html.indexOf('id="etch"') !== -1);
  assert.ok(html.indexOf('id="windshield"') !== -1);
  assert.ok(html.indexOf('id="uvp"') !== -1);
  assert.ok(html.indexOf('id="gps"') !== -1);
  assert.ok(html.indexOf('id="ceramic"') !== -1);
  assert.ok(html.indexOf('id="theft"') !== -1);
  assert.ok(html.indexOf('id="key"') === -1);
  assert.ok(html.indexOf('id="tire"') === -1);
  assert.ok(html.indexOf('id="agFront"') === -1);
  assert.ok(html.indexOf('id="spiff2b"') !== -1);
  assert.ok(src.indexOf("getRange('EB1')") === -1);
  assert.ok(src.indexOf("{ input: 'B39', logCol: 104 }") !== -1);
  assert.ok(src.indexOf("{ input: 'B40', logCol: 123 }") !== -1);
  assert.ok(src.indexOf("setFormula('=SUM(R1:Y1)+DA1+DT1')") !== -1);
  assert.ok(src.indexOf("setFormula('=$B$39')") !== -1);
  assert.ok(src.indexOf("setFormula('=$B$40')") !== -1);
  assert.ok(src.indexOf("=SUM(B17:B24,B39,B40)") !== -1);
  assert.ok(src.indexOf("'', 'frontGross', 'participation', 'warranty', 'gap', 'maint', 'uvp', 'gps'") !== -1);
  assert.ok(src.indexOf("'ceramic', 'paint', 'downPayment'") !== -1);
  assert.ok(html.indexOf('participation + warranty + uvp + gap + maint + ceramic + windshield + theft + gps + etch') !== -1);
  assert.ok(!fs.existsSync(path.join(root, 'dealDialog.html')));
});

vm.runInContext(fs.readFileSync(path.join(root, 'DealManager.gs'), 'utf8'), ctx);

test('logDealFieldAliases_ maps etch to paint, F&I aliases, and spiff2b', function() {
  const a = ctx.logDealFieldAliases_({ etch: '150', spiff2b: '25', windshield: '75', theft: '40' });
  assert.strictEqual(a.paint, '150');
  assert.strictEqual(a.spiff2, '25');
  assert.strictEqual(a.etch, '150');
  assert.strictEqual(a.windshield, '75');
  assert.strictEqual(a.theft, '40');
  const b = ctx.logDealFieldAliases_({ paint: '90', etch: '', spiff2: '10', spiff2b: '99' });
  assert.strictEqual(b.paint, '90');
  assert.strictEqual(b.spiff2, '10');
  const legacy = ctx.logDealFieldAliases_({ uvpProd: '10', starguard: '20', safeshield: '30', key: '11', tire: '22' });
  assert.strictEqual(legacy.uvp, '10');
  assert.strictEqual(legacy.gps, '20');
  assert.strictEqual(legacy.ceramic, '30');
  const fromOldSlots = ctx.logDealFieldAliases_({ key: '15', tire: '25' });
  assert.strictEqual(fromOldSlots.uvp, '15');
  assert.strictEqual(fromOldSlots.gps, '25');
  const c = ctx.logDealFieldAliases_(null);
  assert.strictEqual(Object.keys(c).length, 0);
  assert.ok(ctx.PROTECTED_INDICES.indexOf(25) !== -1, 'Z stays a formula');
  assert.ok(ctx.PROTECTED_INDICES.indexOf(104) === -1, 'DA windshield is a value column');
  assert.ok(ctx.PROTECTED_INDICES.indexOf(123) === -1, 'DT theft is a value column');
});

test('desking dialog recalls by deal #, customer, or stock and lists multiples', function() {
  const html = fs.readFileSync(path.join(root, 'deskingDialog.html'), 'utf8');
  assert.ok(html.indexOf('handleRecallResponse') !== -1);
  assert.ok(html.indexOf('renderSearchResults') !== -1);
  assert.ok(html.indexOf('Deal #, name, or stock #') !== -1);
  assert.ok(html.indexOf('Enter a deal #, customer name, or stock # to recall') !== -1);
  const desk = fs.readFileSync(path.join(root, 'Desking.gs'), 'utf8');
  assert.ok(desk.indexOf('function deskRowMatchesQuery_') !== -1);
  assert.ok(desk.indexOf('if (lastRow < 1) return []') !== -1);
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

const logTpl = fs.readFileSync(path.join(root, 'logDealDialog.html'), 'utf8');
const logMock = [
  '<script>',
  'window.google = { script: { host: { close: function(){} }, run: (function(){',
  '  var api = {',
  '    withSuccessHandler: function(fn) { api._ok = fn; return api; },',
  '    withFailureHandler: function(fn) { api._err = fn; return api; },',
  '    getLogDealDropdowns: function() {',
  "      api._ok({ salesReps:['JANE SALES','BOB ASM'], managers:['DAVID'], salesRoles:{'JANE SALES':'SALES','BOB ASM':'ASM'} });",
  '    },',
  '    getVehicleByStockForLog: function() {',
  "      api._ok({ year:'2026', make:'CHEV', model:'TRAVERSE', vin:'1GNEVJK00TJ000001', hitlistOnList:true, hitlistAmount:300 });",
  '    },',
  "    addDeal: function(n) { api._ok('Deal #' + n + ' added successfully (row 12).'); },",
  "    updateDeal: function(n) { api._ok('Deal #' + n + ' updated successfully (row 12).'); },",
  '    locateDeals: function() {',
  "      api._ok([{rowIndex:6,dealNo:'1102',date:'09/21/2026',firstName:'Maria',lastName:'Barrient',stock:'SC1001'}]);",
  '    },',
  '    recallDealForDialog: function() {',
  "      api._ok({ date:'09/21/2026', dealNo:'1102', saleType:'RETAIL', newUsed:'NEW', sales1:'JANE SALES',",
  "        stock:'SC1001', year:'2026', make:'CHEV', model:'TRAVERSE', vin:'1GNEVJK00TJ000001',",
  "        custFirst:'Maria', custLast:'Barrient', frontGross:1500, warranty:400, uvp:1995, gap:895, maint:1295,",
  "        ceramic:795, windshield:759, theft:695, gps:995, etch:150,",
  "        salesPrice:45000, weowes:0, commCost:100, dlrCash:0, spiff1:50, spiff2:25,",
  "        rebate1Submitted:500, rebate1Code:'BC' });",
  '    },',
  '    clearForm: function() { api._ok(); }',
  '  };',
  '  return api;',
  '})() } };',
  '</script>'
].join('\n');
const logPreview = logTpl.replace('</head>', logMock + '\n</head>');
fs.writeFileSync(path.join(root, 'test', 'log-deal-preview.html'), logPreview);
console.log('Wrote ' + path.join(root, 'test', 'log-deal-preview.html'));

if (failures.length) {
  console.log('\n' + failures.length + ' failed');
  failures.forEach(function(f) { console.log(' - ' + f); });
  process.exit(1);
}
console.log('\nAll tests passed.\n');
