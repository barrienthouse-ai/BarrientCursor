/**
 * Shared deal math for desking, print, and customer quote.
 * Pure JavaScript — no SpreadsheetApp — so Node tests can load this file.
 */

var DESK_COL_COUNT = 73;
var DEAL_NUMBER_COL = 59; // 1-based sheet column BG

function toNumber_(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function roundMoney_(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Maps DMS-style aliases onto desking field names.
 */
function normalizeDeskData(raw) {
  var d = {};
  raw = raw || {};
  var keys = Object.keys(raw);
  for (var i = 0; i < keys.length; i++) {
    d[keys[i]] = raw[keys[i]];
  }
  if (d.stockNum == null && d.stockNumber != null) d.stockNum = d.stockNumber;
  if (d.daysToFirst == null && (d.daysTo1st != null || d.daysToFirst === 0)) {
    d.daysToFirst = d.daysTo1st;
  }
  if (d.tradeAcv == null && d.tradeACV != null) d.tradeAcv = d.tradeACV;
  if ((d.creditYN == null || d.creditYN === '') && d.taxCreditForTrade != null) {
    var t = String(d.taxCreditForTrade).toUpperCase();
    d.creditYN = (t === 'Y' || t === 'YES' || t.indexOf('YES') === 0) ? 'Y' : 'N';
  }
  if (!d.creditYN) d.creditYN = 'Y';
  return d;
}

function isTruthyTaxable_(v) {
  if (v === false || v === 0 || v === '0') return false;
  var s = String(v == null ? 'TRUE' : v).toUpperCase();
  return s !== 'FALSE' && s !== 'NO' && s !== 'N';
}

function isActiveCatalogItem_(item) {
  if (!item) return false;
  if (item.active === false || item.active === 0) return false;
  var s = String(item.active == null ? 'TRUE' : item.active).toUpperCase();
  return s !== 'FALSE' && s !== 'NO' && s !== 'N';
}

/**
 * Sum selected catalog items. Unknown ids are ignored.
 */
function catalogTotals(selectedIds, catalog) {
  var total = 0;
  var taxable = 0;
  var items = [];
  var ids = selectedIds || [];
  var list = catalog || [];
  var seen = {};
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i]);
    if (!id || seen[id]) continue;
    seen[id] = true;
    for (var j = 0; j < list.length; j++) {
      var item = list[j];
      if (!item || String(item.id) !== id) continue;
      if (!isActiveCatalogItem_(item)) break;
      var price = toNumber_(item.price);
      total += price;
      if (isTruthyTaxable_(item.taxable)) taxable += price;
      items.push({
        id: item.id,
        name: item.name || item.id,
        price: roundMoney_(price),
        taxable: isTruthyTaxable_(item.taxable),
        category: item.category || ''
      });
      break;
    }
  }
  return { total: roundMoney_(total), taxable: roundMoney_(taxable), items: items };
}

function deskProductTotal_(d) {
  return toNumber_(d.autoguardPrice) + toNumber_(d.acc1Price) +
    toNumber_(d.acc2Price) + toNumber_(d.acc3Price);
}

function rebateTotal_(d) {
  return toNumber_(d.rebate1) + toNumber_(d.rebate2) + toNumber_(d.rebate3) +
    toNumber_(d.rebate4) + toNumber_(d.rebate5);
}

function feeTotal_(d) {
  return toNumber_(d.docFee) + toNumber_(d.titleFee) + toNumber_(d.licenseFee) +
    toNumber_(d.recordationFee) + toNumber_(d.tempTag) + toNumber_(d.wasteTire) +
    toNumber_(d.stateInspection) + toNumber_(d.handlingFee) +
    toNumber_(d.notaryFee) + toNumber_(d.convenienceFee);
}

function feeDetail_(d) {
  var rows = [
    { key: 'title', label: 'Title Fee', amount: toNumber_(d.titleFee) },
    { key: 'license', label: 'License Fee', amount: toNumber_(d.licenseFee) },
    { key: 'record', label: 'Recordation Fee', amount: toNumber_(d.recordationFee) },
    { key: 'temptag', label: 'Temp Tag', amount: toNumber_(d.tempTag) },
    { key: 'waste', label: 'Waste Tire', amount: toNumber_(d.wasteTire) },
    { key: 'insp', label: 'State Inspection', amount: toNumber_(d.stateInspection) },
    { key: 'handling', label: 'Handling Fee', amount: toNumber_(d.handlingFee) },
    { key: 'notary', label: 'Notary Fee', amount: toNumber_(d.notaryFee) },
    { key: 'conv', label: 'Convenience Fee', amount: toNumber_(d.convenienceFee) }
  ];
  return rows.filter(function (r) { return r.amount > 0; })
    .map(function (r) { r.amount = roundMoney_(r.amount); return r; });
}

function calcPayment_(principal, annualRatePct, termMonths) {
  if (!(principal > 0) || !(termMonths > 0)) return 0;
  var r = toNumber_(annualRatePct) / 100 / 12;
  if (r === 0) return principal / termMonths;
  var pow = Math.pow(1 + r, termMonths);
  return principal * (r * pow) / (pow - 1);
}

function parseLocalDate_(v) {
  if (!v && v !== 0) return null;
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  var s = String(v).trim();
  var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  var us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (us) return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));
  var d = new Date(s);
  if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return null;
}

function formatUsDate_(d) {
  if (!d) return '';
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

function formatIsoDate_(d) {
  if (!d) return '';
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  if (m.length < 2) m = '0' + m;
  if (day.length < 2) day = '0' + day;
  return d.getFullYear() + '-' + m + '-' + day;
}

/**
 * Unified pencil.
 *
 * adjMV = MSRP - savings - rebates + desk products (Autoguard + ACC 1-3)
 * extra = selected quote catalog items (protection + accessories)
 * priceAfterTrade = adjMV + extra - trade allowance + balance to release
 * taxBase = adjMV + taxable extra (warranty/GAP typically not taxable)
 * salesPriceDisplay = priceAfterTrade (unit + products after trade, before down)
 * totalPlusTtl = priceAfterTrade + tax + fees
 * totalFinanced = max(0, totalPlusTtl - down payment)
 *
 * options:
 *   protectionIds, accessoryIds, protectionCatalog, accessoryCatalog
 *   downPayment, apr, term, useOddDays (default true)
 */
function calculateDeal(desk, options) {
  options = options || {};
  var d = normalizeDeskData(desk);
  var mv = toNumber_(d.marketValue);
  var sav = toNumber_(d.savings);
  var rebates = rebateTotal_(d);
  var deskProducts = deskProductTotal_(d);
  var adjMV = mv - sav - rebates + deskProducts;

  var prot = catalogTotals(options.protectionIds, options.protectionCatalog);
  var acc = catalogTotals(options.accessoryIds, options.accessoryCatalog);
  var extra = prot.total + acc.total;
  var extraTaxable = prot.taxable + acc.taxable;

  var tradeAllow = toNumber_(d.tradeAllowance);
  var balRelease = toNumber_(d.balanceToRelease);
  var down = options.downPayment != null ? toNumber_(options.downPayment) : toNumber_(d.cashDeposit);

  var priceAfterTrade = adjMV + extra - tradeAllow + balRelease;
  var taxRate = toNumber_(d.taxRate) / 100;
  var taxBase = adjMV + extraTaxable;
  var tax = taxBase * taxRate;
  if (String(d.creditYN || 'Y').toUpperCase() === 'Y') {
    tax = Math.max(0, tax - tradeAllow * taxRate);
  }

  var fees = feeTotal_(d);
  var totalPlusTtl = priceAfterTrade + tax + fees;
  var totalFinanced = Math.max(0, totalPlusTtl - down);

  var rate = options.apr != null ? toNumber_(options.apr) : toNumber_(d.rate);
  var term = options.term != null ? toNumber_(options.term) : toNumber_(d.term);
  var daysToFirst = toNumber_(d.daysToFirst);
  var useOddDays = options.useOddDays !== false;
  var extraDays = useOddDays ? Math.max(0, daysToFirst - 30) : 0;
  var extraInterest = totalFinanced * (rate / 100 / 365) * extraDays;
  var financedForPmt = totalFinanced + extraInterest;
  var payment = calcPayment_(financedForPmt, rate, term);

  var dealDate = parseLocalDate_(d.date);
  var firstPmt = null;
  if (dealDate && daysToFirst) {
    firstPmt = new Date(dealDate.getFullYear(), dealDate.getMonth(), dealDate.getDate() + Math.round(daysToFirst));
  }

  var gross = mv - sav + deskProducts - toNumber_(d.msrpCost) - toNumber_(d.autoguardCost) -
    toNumber_(d.acc1Cost) - toNumber_(d.acc2Cost) - toNumber_(d.acc3Cost) -
    tradeAllow + toNumber_(d.tradeAcv);

  return {
    marketValue: roundMoney_(mv),
    savings: roundMoney_(sav),
    rebateTotal: roundMoney_(rebates),
    deskProducts: roundMoney_(deskProducts),
    adjMV: roundMoney_(adjMV),
    extraProducts: roundMoney_(extra),
    extraTaxable: roundMoney_(extraTaxable),
    protectionTotal: prot.total,
    accessoriesTotal: acc.total,
    protectionItems: prot.items,
    accessoryItems: acc.items,
    tradeAllowance: roundMoney_(tradeAllow),
    balanceToRelease: roundMoney_(balRelease),
    downPayment: roundMoney_(down),
    priceAfterTrade: roundMoney_(priceAfterTrade),
    salesPrice: roundMoney_(priceAfterTrade),
    taxRate: toNumber_(d.taxRate),
    taxBase: roundMoney_(taxBase),
    tax: roundMoney_(tax),
    fees: roundMoney_(fees),
    feeDetail: feeDetail_(d),
    docFee: roundMoney_(toNumber_(d.docFee)),
    totalPlusTtl: roundMoney_(totalPlusTtl),
    totalFinanced: roundMoney_(totalFinanced),
    extraInterest: roundMoney_(extraInterest),
    daysToFirst: daysToFirst,
    rate: roundMoney_(rate),
    term: term,
    payment: roundMoney_(payment),
    firstPaymentDate: formatUsDate_(firstPmt),
    firstPaymentIso: formatIsoDate_(firstPmt),
    gross: roundMoney_(gross),
    creditYN: String(d.creditYN || 'Y').toUpperCase() === 'Y' ? 'Y' : 'N'
  };
}

function getRateFromMatrix(rateMatrix, term, tier) {
  if (!rateMatrix) return null;
  var row = rateMatrix[String(term)] || rateMatrix[Number(term)];
  if (!row) return null;
  var rate = row[tier];
  if (rate === undefined || rate === null || rate === '') return null;
  var n = parseFloat(rate);
  return isNaN(n) ? null : n;
}

function getValidTermsForTier(rateMatrix, tier) {
  var terms = [];
  if (!rateMatrix) return terms;
  var keys = Object.keys(rateMatrix);
  for (var i = 0; i < keys.length; i++) {
    var t = Number(keys[i]);
    if (getRateFromMatrix(rateMatrix, t, tier) !== null) terms.push(t);
  }
  terms.sort(function (a, b) { return a - b; });
  return terms;
}

/**
 * Names already on the desk (Autoguard / ACC 1-3) should not also appear
 * as selectable catalog items, or the customer can double-buy them.
 */
function filterCatalogAgainstDesk(catalog, desk) {
  var d = normalizeDeskData(desk);
  var labels = [d.autoguardLabel, d.acc1Label, d.acc2Label, d.acc3Label]
    .map(function (s) { return String(s || '').trim().toLowerCase(); })
    .filter(function (s) { return s && s !== 'autoguard' && s.indexOf('acc ') !== 0; });
  var agOn = toNumber_(d.autoguardPrice) > 0;
  return (catalog || []).filter(function (item) {
    if (!item) return false;
    var name = String(item.name || '').trim().toLowerCase();
    var id = String(item.id || '').toLowerCase();
    if (agOn && (id === 'autoguard' || name === 'autoguard')) return false;
    for (var i = 0; i < labels.length; i++) {
      if (name === labels[i] || id === labels[i]) return false;
    }
    return true;
  });
}

function redactDeskForCustomer(desk) {
  var d = normalizeDeskData(desk);
  var keep = [
    'date', 'salesperson', 'manager', 'customerName', 'dealNumber',
    'stockNum', 'newUsed', 'vin', 'mileage', 'year', 'make', 'model',
    'color', 'vehicleType',
    'tradePayoff', 'tradeVin', 'tradeMileage', 'tradeVehicle', 'tradeColor',
    'tradeType', 'tradeAllowance', 'balanceToRelease', 'cashDeposit',
    'marketValue', 'savings',
    'rebate1', 'rebate2', 'rebate3', 'rebate4', 'rebate5',
    'rebate1Label', 'rebate2Label', 'rebate3Label', 'rebate4Label', 'rebate5Label',
    'autoguardPrice', 'autoguardLabel',
    'acc1Price', 'acc1Label', 'acc2Price', 'acc2Label', 'acc3Price', 'acc3Label',
    'creditYN', 'rate', 'term', 'taxRate', 'daysToFirst',
    'docFee', 'titleFee', 'licenseFee', 'recordationFee', 'tempTag',
    'wasteTire', 'stateInspection', 'handlingFee', 'notaryFee', 'convenienceFee',
    'quoteDefaultTerm', 'quoteAllowTermChange', 'quotePreselectedProtection',
    'quotePreselectedAccessories', 'quoteDefaultTier'
  ];
  var out = {};
  for (var i = 0; i < keep.length; i++) {
    if (d[keep[i]] !== undefined && d[keep[i]] !== null && d[keep[i]] !== '') {
      out[keep[i]] = d[keep[i]];
    }
  }
  return out;
}
