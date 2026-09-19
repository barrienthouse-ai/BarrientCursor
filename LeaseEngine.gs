/**
 * Lease Quoting & Management Engine.
 * Menus live in Code.gs (GEAUX TOOLS). Do not add function onOpen() here.
 */

function openLeaseCalculator() {
  var html = HtmlService.createHtmlOutputFromFile('LeaseForm')
      .setWidth(1000)
      .setHeight(850);
  SpreadsheetApp.getUi().showModalDialog(html, 'Lease Quoting & Management Engine');
}

function showDashboard() {
  var html = HtmlService.createTemplateFromFile('ladderBonusBuilder').evaluate()
      .setWidth(750)
      .setHeight(650)
      .setTitle('Sales Ladder Bonus Calculator');
  SpreadsheetApp.getUi().showSidebar(html);
}

function getPersonnelDropdownData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  /* Try common casings for the setup sheet name */
  var sheet = ss.getSheetByName('SETUP')
             || ss.getSheetByName('Setup')
             || ss.getSheetByName('setup')
             || ss.getSheetByName('SetUp');

  if (!sheet) {
    /* Last resort: scan all sheets for a case-insensitive 'setup' match */
    var allSheets = ss.getSheets();
    var sheetNames = allSheets.map(function(s) { return s.getName(); });
    for (var i = 0; i < allSheets.length; i++) {
      if (allSheets[i].getName().toLowerCase() === 'setup') {
        sheet = allSheets[i];
        break;
      }
    }
    /* If still not found, return diagnostic object so GAS doesn't serialize as null */
    if (!sheet) {
      return { error: 'Setup sheet not found. Available sheets: ' + sheetNames.join(', '), names: [] };
    }
  }

  var values = sheet.getRange('A7:A62').getValues();

  /* Convert every cell to a plain string first — prevents GAS from failing
     to serialize Date objects (which appear in the range) back to the dialog */
  var allStrings = values.map(function(r) {
    var v = r[0];
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return '';          /* skip date cells */
    return String(v).trim();
  });

  /* Split at the 'MANAGERS:' label row into two separate lists */
  var reps = [];
  var managers = [];
  var inManagers = false;
  allStrings.forEach(function(v) {
    if (!v || v === '.' || v === '-') return;  /* skip blanks and dot placeholders */
    if (v.toUpperCase() === 'MANAGERS:' || v.toUpperCase() === 'MANAGERS') {
      inManagers = true;
      return;
    }
    if (inManagers) {
      managers.push(v);
    } else {
      reps.push(v);
    }
  });

  return { sheetFound: sheet.getName(), reps: reps, managers: managers };
}

function getSavedQuotesList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName('LEASEWORKSHEETLOG2');
  if (!logSheet || logSheet.getLastRow() < 2) return { quotes: [] };

  var data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 5).getValues();
  var uniqueQuotes = {};

  for (var i = 0; i < data.length; i++) {
    var id       = String(data[i][1] || '').trim();  // col B = Quote ID
    var customer = String(data[i][4] || '').trim();  // col E = Customer Name
    if (id && !uniqueQuotes[id]) {
      uniqueQuotes[id] = id + ' - ' + customer;
    }
  }
  return { quotes: Object.values(uniqueQuotes) };  // object avoids GAS null-serialization
}

function getQuoteById(rawQuoteString) {
  var quoteId = String(rawQuoteString).split(' - ')[0].trim();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName('LEASEWORKSHEETLOG2');
  if (!logSheet) return { error: 'LEASEWORKSHEETLOG2 sheet not found' };

  var data = logSheet.getDataRange().getValues();
  /* col B (index 1) = Quote ID */
  var subset = data.filter(function(row) { return String(row[1]) === quoteId; });
  if (subset.length === 0) return { error: 'Quote ID not found: ' + quoteId };

  var firstRow = subset[0];

  /* Sanitize every cell — GAS cannot serialize Date objects back to the HTML dialog.
     Convert Dates to ISO strings, leave numbers as numbers, everything else to string. */
  function safe(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (typeof v === 'number') return v;
    return String(v);
  }

  /* Column map (0-indexed): A=0 Timestamp, B=1 QuoteID, C=2 SalesRep, D=3 SalesMgr,
     E=4 CustName, F=5 CustAddr, G=6 Stock, H=7 Year, I=8 Make, J=9 Model, K=10 VIN,
     L=11 MSRP, M=12 SellingPrice, N=13 GrossCapCost, O=14 TradeAllow, P=15 TradePayoff,
     Q=16 NetEquity, R=17 CapCostRed, S=18 AdjCapCost, T=19 Term, U=20 Mileage,
     V=21 DAS, W=22 MF, X=23 Residual$, Y=24 PreTaxPmt, Z=25 MonthlyTax,
     AA=26 TotalPmt, AB=27 TaxMode, AC=28 TradeTaxCredit, AD=29 Rebate,
     AE=30 CapFees, AF=31 Coverage, AG=32 CreditTier, AH=33 QuoteDate, AI=34 CustPhone */
  var formData = {
    existingQuoteId:  safe(firstRow[1]),
    salesRep:         safe(firstRow[2]),
    salesManager:     safe(firstRow[3]),
    customerName:     safe(firstRow[4]),
    customerAddress:  safe(firstRow[5]),
    stockNumber:      safe(firstRow[6]),
    year:             safe(firstRow[7]),
    make:             safe(firstRow[8]),
    model:            safe(firstRow[9]),
    vin:              safe(firstRow[10]),
    msrp:             safe(firstRow[11]),
    sellingPrice:     safe(firstRow[12]),
    tradeAllowance:   safe(firstRow[14]),
    tradePayoff:      safe(firstRow[15]),
    taxMode:          safe(firstRow[27]),
    tradeTaxCredit:   safe(firstRow[28]),
    rebate:           safe(firstRow[29]),
    capFees:          safe(firstRow[30]),
    coverage:         safe(firstRow[31]),
    creditTierLabel:  safe(firstRow[32]),
    quoteDate:        safe(firstRow[33]),
    customerPhone:    safe(firstRow[34]),
    taxRate:          safe(firstRow[35]) || 8.0, /* AJ Tax Rate (%) */
    gmRateModel:      safe(firstRow[36])           /* AK GM Rate Guide Model */
  };

  var uniqueTerms    = Array.from(new Set(subset.map(function(r){ return parseInt(r[19]); }))).sort(function(a,b){return a-b;});
  var uniqueMileages = Array.from(new Set(subset.map(function(r){ return parseInt(r[20]); }))).sort(function(a,b){return a-b;});
  var uniqueDas      = Array.from(new Set(subset.map(function(r){ return parseFloat(r[21]); }))).sort(function(a,b){return a-b;});

  formData.term1 = uniqueTerms[0]    || 24;    formData.term2 = uniqueTerms[1]    || 36;    formData.term3 = uniqueTerms[2]    || 48;
  formData.mile1 = uniqueMileages[0] || 10000; formData.mile2 = uniqueMileages[1] || 12000; formData.mile3 = uniqueMileages[2] || 15000;
  formData.das1  = uniqueDas[0]      || 0;     formData.das2  = uniqueDas[1]      || 2000;  formData.das3  = uniqueDas[2]      || 5000;

  /* Effective MF stored in col W (index 22) — use first match per term */
  formData.mf1 = (subset.find(function(r){ return parseInt(r[19])===formData.term1; }) || [])[22] || 0;
  formData.mf2 = (subset.find(function(r){ return parseInt(r[19])===formData.term2; }) || [])[22] || 0;
  formData.mf3 = (subset.find(function(r){ return parseInt(r[19])===formData.term3; }) || [])[22] || 0;

  /* Residual % back-calculated from stored residual $ / MSRP */
  var msrp = parseFloat(firstRow[11]) || 1;
  function rv(t,m){ var row=subset.find(function(r){return parseInt(r[19])===t&&parseInt(r[20])===m;}); return row ? (parseFloat(row[23])/msrp*100).toFixed(1) : '0'; }
  formData.res1_1=rv(formData.term1,formData.mile1); formData.res1_2=rv(formData.term1,formData.mile2); formData.res1_3=rv(formData.term1,formData.mile3);
  formData.res2_1=rv(formData.term2,formData.mile1); formData.res2_2=rv(formData.term2,formData.mile2); formData.res2_3=rv(formData.term2,formData.mile3);
  formData.res3_1=rv(formData.term3,formData.mile1); formData.res3_2=rv(formData.term3,formData.mile2); formData.res3_3=rv(formData.term3,formData.mile3);

  return formData;
}

function processSaveAndPrint(formData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  /* Sheet name without trailing ! */
  var logSheet = ss.getSheetByName('LEASEWORKSHEETLOG2');
  if (!logSheet) throw new Error("Sheet 'LEASEWORKSHEETLOG2' not found. Check the tab name.");

  var quoteId = formData.existingQuoteId || 'Q-' + Math.floor(100000 + Math.random() * 900000);
  var timestamp = new Date();

  /* Delete existing rows for this quote if updating */
  if (formData.existingQuoteId) {
    var oldData = logSheet.getDataRange().getValues();
    for (var i = oldData.length - 1; i >= 1; i--) {
      if (String(oldData[i][1]) === String(quoteId)) logSheet.deleteRow(i + 1);
    }
  }

  /* ── Parse all form values ── */
  var msrp          = parseFloat(formData.msrp)          || 0;
  var sellingPrice  = parseFloat(formData.sellingPrice)  || 0;
  var tradeAllow    = parseFloat(formData.tradeAllowance)|| 0;
  var tradePayoff   = parseFloat(formData.tradePayoff)   || 0;
  var rebate        = parseFloat(formData.rebate)        || 0;
  var capFees       = parseFloat(formData.capFees)       || 0;
  var coverage      = parseFloat(formData.coverage)      || 0;
  var tierAdd       = parseFloat(formData.creditTier)    || 0;
  var taxRate       = (parseFloat(formData.taxRate)      || 0) / 100;
  var taxMode       = formData.taxMode || 'monthly_usage';
  /* creditTierLabel is now sent explicitly from the form; derive from numeric add as fallback */
  var TIER_LABELS = {'0':'A+/A1','0.00063':'A2','0.00108':'A3','0.00206':'B1','0.00283':'B2','0.00313':'B3'};
  var creditTierLbl = formData.creditTierLabel ||
                      TIER_LABELS[String(parseFloat(formData.creditTier || 0).toFixed(5))] ||
                      'A+/A1';

  var terms    = [parseInt(formData.term1), parseInt(formData.term2), parseInt(formData.term3)];
  var mileages = [parseInt(formData.mile1), parseInt(formData.mile2), parseInt(formData.mile3)];
  var dasOpts  = [parseFloat(formData.das1), parseFloat(formData.das2), parseFloat(formData.das3)];
  var baseMFs  = [parseFloat(formData.mf1)||0, parseFloat(formData.mf2)||0, parseFloat(formData.mf3)||0];
  var resPcts  = [
    [parseFloat(formData.res1_1)||0, parseFloat(formData.res1_2)||0, parseFloat(formData.res1_3)||0],
    [parseFloat(formData.res2_1)||0, parseFloat(formData.res2_2)||0, parseFloat(formData.res2_3)||0],
    [parseFloat(formData.res3_1)||0, parseFloat(formData.res3_2)||0, parseFloat(formData.res3_3)||0]
  ];

  /* ── CDK-correct cap cost components ── */
  /* Non-cash CCR = rebate + full trade allowance (CDK model) */
  var nonCashCCR  = rebate + tradeAllow;
  /* Gross cap cost = selling price + cap fees + coverage + trade payoff */
  var grossCapCost = sellingPrice + capFees + coverage + tradePayoff;

  var rowsToAppend = [];

  for (var t = 0; t < 3; t++) {
    var term = terms[t];
    var mf   = baseMFs[t] + tierAdd;   /* effective MF with tier add */
    for (var m = 0; m < 3; m++) {
      var mileage   = mileages[m];
      var resPct    = resPcts[t][m];   /* already a percentage, e.g. 58 */
      var residual  = msrp * (resPct / 100);

      for (var d = 0; d < 3; d++) {
        var das = dasOpts[d];

        /* Simultaneous-equation solver: split DAS into firstPmt + customerCCR + customerCCRTax
           Effective G = grossCapCost - nonCashCCR
           customerCCR = [das/(1+tr) - (G-R)/T - (G+R)*MF] / [1 - 1/T - MF]   */
        var G = grossCapCost - nonCashCCR;
        var R = residual;
        var T = term;
        var tr = taxRate;

        var customerCCR = (das / (1 + tr) - (G - R) / T - (G + R) * mf) / (1 - 1/T - mf);
        if (customerCCR < 0) customerCCR = 0;
        var adjCapCost  = G - customerCCR;
        var basePayment = ((adjCapCost - R) / T) + ((adjCapCost + R) * mf);
        var finalPayment = basePayment * (1 + tr);
        var monthlyTax   = finalPayment - basePayment;
        var capCostRed   = customerCCR + nonCashCCR;  /* total CCR for log */

        /* Col order matches LEASEWORKSHEETLOG2 headers A-AI (35 cols) */
        rowsToAppend.push([
          timestamp,            // A  Timestamp
          quoteId,              // B  Quote ID
          formData.salesRep,    // C  Sales Rep
          formData.salesManager,// D  Sales Manager
          formData.customerName,// E  Customer Name
          formData.customerAddress, // F Customer Address
          formData.stockNumber, // G  Stock Number
          formData.year,        // H  Year
          formData.make,        // I  Make
          formData.model,       // J  Model
          formData.vin,         // K  VIN
          msrp,                 // L  MSRP
          sellingPrice,         // M  Selling Price
          grossCapCost,         // N  Gross Cap Cost
          tradeAllow,           // O  Trade Allowance
          tradePayoff,          // P  Trade Payoff
          tradeAllow - tradePayoff, // Q Net Trade Equity
          capCostRed,           // R  Cap Cost Reduction (total)
          adjCapCost,           // S  Adj Cap Cost
          term,                 // T  Term (Mo)
          mileage,              // U  Mileage Limit
          das,                  // V  Due At Signing
          mf,                   // W  Money Factor (effective)
          residual,             // X  Residual Value ($)
          basePayment.toFixed(2),   // Y  Pre-Tax Payment
          monthlyTax.toFixed(2),    // Z  Monthly Tax
          finalPayment.toFixed(2),  // AA Total Monthly Payment
          taxMode,              // AB Tax Mode
          formData.tradeTaxCredit || '', // AC Trade Tax Credit
          rebate,               // AD Rebate
          capFees,              // AE Cap Fees
          coverage,             // AF Coverage
          creditTierLbl,        // AG Credit Tier
          formData.quoteDate || Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd'), // AH Quote Date
          formData.customerPhone || '', // AI Customer Phone
          (parseFloat(formData.taxRate) || 0), // AJ Tax Rate (%)
          formData.gmRateModel || ''            // AK GM Rate Guide Model
        ]);
      }
    }
  }

  /* Append all rows in one batch write */
  var firstEmptyRow = logSheet.getLastRow() + 1;
  logSheet.getRange(firstEmptyRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);

  return { success: true, quoteId: quoteId };
}

/* ── GM Financial Lease Rates ─────────────────────────────────────────────
   Reads GMFRESIDUALGUIDE sheet and returns rate data for a specific model
   or the full model list. All residuals in the sheet are for 15k miles/year.
   Mileage adjustments: +4% for 10k, +2% for 12k (standard GM published adds).
   ──────────────────────────────────────────────────────────────────────── */

function getGMModelList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GMFRESIDUALGUIDE');
  if (!sheet) return { error: 'GMFRESIDUALGUIDE sheet not found', models: [] };

  var lastRow = sheet.getLastRow();
  var values = sheet.getRange('A1:A' + lastRow).getValues();

  var SKIP_PATTERNS = [
    /^\s*$/, /^CAR$/i, /^TRUCK$/i, /^CUV\/SUV$/i, /^FSSUV$/i,
    /^VIEW ALL PROGRAMS$/i, /^Supported Lease/i, /^Money Factor/i,
    /^Tier/i, /^A\+\/A1/i, /^A2$/i, /^A3$/i, /^B1$/i, /^B2$/i, /^B3$/i,
    /^Mileage/i, /^Super Ultralow/i, /^Ultralow/i, /^Low$/i, /^Standard$/i,
    /^Max Allowed/i, /^Customer Early/i, /^Security Deposit/i,
    /^Single-payment/i, /^\$-$/
  ];

  /* Track current model year as we scan column A */
  var currentYear = null;
  var models = [];
  var seen = {};

  values.forEach(function(r) {
    var v = String(r[0] || '').trim();
    if (!v) return;

    /* Detect model year header rows */
    var yearMatch = v.match(/Model Year\s+(\d{4})/);
    if (yearMatch) { currentYear = yearMatch[1]; return; }

    var skip = SKIP_PATTERNS.some(function(p) { return p.test(v); });
    if (skip || v.length <= 8) return;

    /* Prefix with model year so same-named models are distinct */
    var key = (currentYear ? currentYear + ' ' : '') + v;
    if (!seen[key]) {
      seen[key] = true;
      models.push(key);
    }
  });

  return { count: models.length, models: models };
}

function getGMLeaseRates(modelName) {
  /* modelName is in the format "YYYY MODEL NAME" e.g. "2026 TAHOE 4WD 4DR WGN LT"
     Split off the leading year to do a year-aware lookup. */
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GMFRESIDUALGUIDE');
  if (!sheet) return { error: 'GMFRESIDUALGUIDE sheet not found' };

  /* Parse year prefix from the key passed by the dropdown */
  var yearMatch = modelName.match(/^(\d{4})\s+(.+)$/);
  var targetYear = yearMatch ? yearMatch[1] : null;
  var targetModel = yearMatch ? yearMatch[2].trim().toLowerCase() : modelName.trim().toLowerCase();

  var lastRow = sheet.getLastRow();
  var data = sheet.getRange('A1:AV' + lastRow).getValues();

  /* Column map (0-indexed): term → [mfCol, rvCol] — confirmed from header analysis */
  var COL = {
    24: [10, 15],
    27: [17, 23],
    36: [24, 30],
    39: [31, 38],
    48: [39, 47]
  };

  /* Scan rows, tracking current model year via header rows */
  var currentYear = null;
  var matchRow = null;

  for (var i = 0; i < data.length; i++) {
    var cell = String(data[i][0] || '').trim();
    if (!cell) continue;

    /* Detect model year header */
    var ym = cell.match(/Model Year\s+(\d{4})/);
    if (ym) { currentYear = ym[1]; continue; }

    /* Match: year must match (if provided) AND model name must match */
    var cellLower = cell.toLowerCase();
    var yearOk = !targetYear || (currentYear === targetYear);
    if (yearOk && cellLower === targetModel) {
      matchRow = data[i];
      break;
    }
  }

  if (!matchRow) return { error: 'Model not found: ' + modelName };

  /* Extract MF and base RV (15k/yr) for each term, then compute mileage-adjusted RVs.
     GM Financial mileage add rules (per program rules on GMFRESIDUALGUIDE):
       24–35 mo:  12k/yr +1%,  10k/yr +2%,  7.5k/yr +3%
       36–47 mo:  12k/yr +2%,  10k/yr +3%,  7.5k/yr +4%
       48+   mo:  12k/yr +3%,  10k/yr +4%,  7.5k/yr +5%  */
  var rates = {};
  Object.keys(COL).forEach(function(term) {
    var cols = COL[term];
    var mf    = parseFloat(String(matchRow[cols[0]] || '').replace('%','')) || 0;
    var rv15k = parseFloat(String(matchRow[cols[1]] || '').replace('%','')) || 0;
    var t = parseInt(term);
    var add12k, add10k, add75k;
    if      (t <= 35) { add12k = 1; add10k = 2; add75k = 3; }
    else if (t <= 47) { add12k = 2; add10k = 3; add75k = 4; }
    else              { add12k = 3; add10k = 4; add75k = 5; }
    rates['t' + term] = {
      mf:    mf,
      rv15k: rv15k,
      rv12k: rv15k > 0 ? rv15k + add12k : 0,
      rv10k: rv15k > 0 ? rv15k + add10k : 0,
      rv75k: rv15k > 0 ? rv15k + add75k : 0
    };
  });

  return { model: modelName, year: targetYear, rates: rates };
}

/* ── Dealer identity persistence ──────────────────────────────────────────
   These MUST be top-level functions (not nested inside another function)
   for google.script.run to be able to call them from the HTML dialog.
   ──────────────────────────────────────────────────────────────────────── */
function saveDealerDefaults(defaults) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('dealerLogoDataUrl',  defaults.logoDataUrl   || '');
  props.setProperty('dealerName',         defaults.dealerName    || '');
  props.setProperty('dealerPhone',        defaults.dealerPhone   || '');
  props.setProperty('dealerAddress',      defaults.dealerAddress || '');
}

function getDealerDefaults() {
  var props = PropertiesService.getScriptProperties();
  return {
    logoDataUrl:   props.getProperty('dealerLogoDataUrl') || '',
    dealerName:    props.getProperty('dealerName')        || '',
    dealerPhone:   props.getProperty('dealerPhone')       || '',
    dealerAddress: props.getProperty('dealerAddress')     || ''
  };
}
