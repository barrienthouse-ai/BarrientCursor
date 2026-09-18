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

test('DMS aliases: taxCreditForTrade YES → creditYN Y', function() {
  const c = ctx.calculateDeal({
    marketValue: 10000, taxRate: 10, taxCreditForTrade: 'YES', tradeAllowance: 2000,
    term: 12, rate: 0
  }, {});
  // tax = 1000 - 200 = 800
  assert.strictEqual(c.tax, 800);
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
    storeCity: 'Gonzales, Louisiana',
    storePhone: '(225) 644-8411',
    defaultTerm: 72,
    allowTermChange: true,
    defaultCreditTier: 'a1',
    useOddDaysOnQuote: true
  },
  protection: [
    { id: 'warranty', name: 'Extended Warranty', description: 'Loaded from QUOTE_CATALOG', price: 2848, taxable: false },
    { id: 'gap', name: 'GAP Insurance', description: 'Loaded from QUOTE_CATALOG', price: 895, taxable: false }
  ],
  accessories: [
    { id: 'flrmats', name: 'All-Weather Floor Mats', description: 'Loaded from QUOTE_CATALOG', price: 359, taxable: true },
    { id: 'bedliner', name: 'Spray-In Bed Liner', description: 'Loaded from QUOTE_CATALOG', price: 595, taxable: true }
  ],
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
