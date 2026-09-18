/**
 * Shared Desking Tool — spreadsheet CRUD.
 * DESKDATA rows 1-4 = manager staging (from MANAGER_STAGING sheet)
 * DESKDATA row 5+   = history
 * Column BG (59)    = deal number
 * Columns 72-73     = daysToFirst, firstPaymentDate
 */

function OPEN_DESKING_TOOL() {
  ensureConfigSheets();
  var html = HtmlService.createTemplateFromFile('deskingDialog')
    .evaluate()
    .setTitle('Shared Desking Tool')
    .setWidth(1600)
    .setHeight(950);
  SpreadsheetApp.getUi().showModalDialog(html, 'Shared Desking Tool');
}

function getDeskingInitialData() {
  ensureConfigSheets();
  var ss = getActiveSs_();
  var setupSheet = ss.getSheetByName('SETUP');
  var salespeople = [];
  var managers = [];
  if (setupSheet) {
    salespeople = setupSheet.getRange('A7:A52').getValues().flat().filter(function (v) {
      return v !== '' && v !== null;
    });
    managers = setupSheet.getRange('A57:A62').getValues().flat().filter(function (v) {
      return v !== '' && v !== null;
    });
  }
  var store = getStoreSettings();
  return {
    salespeople: salespeople,
    managers: managers,
    defaultFees: getDefaultFees(),
    quoteCatalog: {
      protection: getProtectionCatalog(),
      accessories: getAccessoryCatalog()
    },
    quoteSettings: {
      defaultTerm: store.defaultTerm,
      allowTermChange: store.allowTermChange,
      defaultCreditTier: store.defaultCreditTier
    },
    rateTerms: Object.keys(getRateMatrix()).map(Number).sort(function (a, b) { return a - b; }),
    tiers: getCreditTiers(),
    store: store
  };
}

function getVehicleByStock(stockNum) {
  if (!stockNum) return null;
  var ss = getActiveSs_();
  var invSheet = ss.getSheetByName('INV');
  if (!invSheet) return null;
  var data = invSheet.getDataRange().getValues();
  for (var i = 5; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(stockNum).trim()) {
      var row = data[i];
      return {
        newUsed: row[1] || '',
        year: row[2] || '',
        make: row[3] || '',
        model: row[4] || '',
        type: row[6] || '',
        color: row[8] || '',
        vin: row[16] || '',
        mileage: row[18] || '',
        msrp: row[10] || 0,
        cost: row[11] || 0,
        rebate: 0
      };
    }
  }
  return null;
}

function getNextDealNumber_(deskSheet) {
  var lastRow = deskSheet.getLastRow();
  if (lastRow < 5) return 1001;
  var dealNums = deskSheet.getRange(5, DEAL_NUMBER_COL, lastRow - 4, 1).getValues();
  var maxBase = 1000;
  for (var i = 0; i < dealNums.length; i++) {
    var raw = String(dealNums[i][0]).trim();
    if (!raw) continue;
    var base = parseInt(raw.split('.')[0], 10);
    if (!isNaN(base) && base > maxBase) maxBase = base;
  }
  return maxBase + 1;
}

function findDealRow_(deskSheet, dealNumber) {
  var lastRow = deskSheet.getLastRow();
  if (lastRow < 5) return -1;
  var dealNums = deskSheet.getRange(5, DEAL_NUMBER_COL, lastRow - 4, 1).getValues();
  var target = String(dealNumber).trim();
  for (var i = dealNums.length - 1; i >= 0; i--) {
    if (String(dealNums[i][0]).trim() === target) return i + 5;
  }
  return -1;
}

function getNextPrintVersion_(deskSheet, baseDealNum) {
  var lastRow = deskSheet.getLastRow();
  if (lastRow < 5) return String(baseDealNum) + '.1';
  var dealNums = deskSheet.getRange(5, DEAL_NUMBER_COL, lastRow - 4, 1).getValues();
  var baseStr = String(baseDealNum);
  var maxVersion = 0;
  for (var i = 0; i < dealNums.length; i++) {
    var raw = String(dealNums[i][0]).trim();
    if (!raw) continue;
    var parts = raw.split('.');
    if (parts[0] === baseStr && parts.length > 1) {
      var v = parseInt(parts[1], 10);
      if (!isNaN(v) && v > maxVersion) maxVersion = v;
    }
  }
  return baseStr + '.' + (maxVersion + 1);
}

function buildRowData_(deskData, dealNum) {
  var d = normalizeDeskData(deskData);
  var calc = calculateDeal(d, {});
  var rowData = new Array(DESK_COL_COUNT).fill('');
  rowData[0]  = d.date || new Date();
  rowData[1]  = d.salesperson;
  rowData[2]  = d.manager;
  rowData[3]  = d.customerName;
  rowData[4]  = d.address;
  rowData[5]  = d.ssn;
  rowData[6]  = d.email;
  rowData[7]  = d.homePhone;
  rowData[8]  = d.workPhone;
  rowData[9]  = d.cellPhone;
  rowData[10] = d.dob;
  rowData[11] = d.stockNum;
  rowData[12] = d.newUsed;
  rowData[13] = d.vin;
  rowData[14] = d.mileage;
  rowData[15] = d.year;
  rowData[16] = d.make;
  rowData[17] = d.model;
  rowData[18] = d.color;
  rowData[19] = d.vehicleType;
  rowData[20] = d.tradePayoff;
  rowData[21] = d.tradeVin;
  rowData[22] = d.tradeMileage;
  rowData[23] = d.tradeVehicle;
  rowData[24] = d.tradeColor;
  rowData[25] = d.tradeType;
  rowData[26] = d.marketValue;
  rowData[27] = d.savings;
  rowData[28] = d.rebate1;
  rowData[29] = d.rebate2;
  rowData[30] = d.adjustedMarketValue != null && d.adjustedMarketValue !== ''
    ? d.adjustedMarketValue : calc.adjMV;
  rowData[31] = d.autoguardPrice;
  rowData[32] = d.acc1Price;
  rowData[33] = d.acc2Price;
  rowData[34] = d.acc3Price;
  rowData[35] = d.tradeAllowance;
  rowData[36] = d.balanceToRelease;
  rowData[37] = d.cashDeposit;
  rowData[38] = d.creditYN;
  rowData[39] = d.rate;
  rowData[40] = d.term;
  rowData[41] = d.taxRate;
  rowData[42] = d.docFee;
  rowData[43] = d.titleFee;
  rowData[44] = d.licenseFee;
  rowData[45] = d.recordationFee;
  rowData[46] = d.tempTag;
  rowData[47] = d.wasteTire;
  rowData[48] = d.stateInspection;
  rowData[49] = d.handlingFee;
  rowData[50] = d.notaryFee;
  rowData[51] = d.convenienceFee;
  rowData[52] = d.msrpCost;
  rowData[53] = d.autoguardCost;
  rowData[54] = d.acc1Cost;
  rowData[55] = d.tradeAcv;
  rowData[56] = d.acc1Label;
  rowData[57] = d.acc2Label;
  rowData[58] = dealNum;
  rowData[59] = d.acc3Label;
  rowData[60] = d.autoguardLabel;
  rowData[61] = d.rebate1Label;
  rowData[62] = d.rebate2Label;
  rowData[63] = d.acc2Cost;
  rowData[64] = d.acc3Cost;
  rowData[65] = d.rebate3;
  rowData[66] = d.rebate4;
  rowData[67] = d.rebate5;
  rowData[68] = d.rebate3Label;
  rowData[69] = d.rebate4Label;
  rowData[70] = d.rebate5Label;
  rowData[71] = d.daysToFirst;
  rowData[72] = d.firstPaymentDate || calc.firstPaymentDate;
  return rowData;
}

function rowToDesk_(row) {
  var rawDate = row[0];
  var dateStr = '';
  var dateDisplay = '';
  var parsed = parseLocalDate_(rawDate);
  if (parsed) {
    dateStr = formatIsoDate_(parsed);
    dateDisplay = formatUsDate_(parsed);
  } else if (rawDate) {
    dateStr = String(rawDate);
    dateDisplay = String(rawDate);
  }
  return {
    date: dateStr,
    dateDisplay: dateDisplay,
    salesperson: row[1],
    manager: row[2],
    customerName: row[3],
    address: row[4],
    ssn: row[5],
    email: row[6],
    homePhone: row[7],
    workPhone: row[8],
    cellPhone: row[9],
    dob: row[10],
    stockNum: row[11],
    newUsed: row[12],
    vin: row[13],
    mileage: row[14],
    year: row[15],
    make: row[16],
    model: row[17],
    color: row[18],
    vehicleType: row[19],
    tradePayoff: row[20],
    tradeVin: row[21],
    tradeMileage: row[22],
    tradeVehicle: row[23],
    tradeColor: row[24],
    tradeType: row[25],
    marketValue: row[26],
    savings: row[27],
    rebate1: row[28],
    rebate2: row[29],
    adjustedMarketValue: row[30],
    autoguardPrice: row[31],
    acc1Price: row[32],
    acc2Price: row[33],
    acc3Price: row[34],
    tradeAllowance: row[35],
    balanceToRelease: row[36],
    cashDeposit: row[37],
    creditYN: row[38],
    rate: row[39],
    term: row[40],
    taxRate: row[41],
    docFee: row[42],
    titleFee: row[43],
    licenseFee: row[44],
    recordationFee: row[45],
    tempTag: row[46],
    wasteTire: row[47],
    stateInspection: row[48],
    handlingFee: row[49],
    notaryFee: row[50],
    convenienceFee: row[51],
    msrpCost: row[52],
    autoguardCost: row[53],
    acc1Cost: row[54],
    tradeAcv: row[55],
    acc1Label: row[56],
    acc2Label: row[57],
    dealNumber: row[58],
    acc3Label: row[59],
    autoguardLabel: row[60],
    rebate1Label: row[61],
    rebate2Label: row[62],
    acc2Cost: row[63],
    acc3Cost: row[64],
    rebate3: row[65],
    rebate4: row[66],
    rebate5: row[67],
    rebate3Label: row[68],
    rebate4Label: row[69],
    rebate5Label: row[70],
    daysToFirst: row.length > 71 ? row[71] : '',
    firstPaymentDate: row.length > 72 ? row[72] : ''
  };
}

function getDeskSheet_() {
  var ss = getActiveSs_();
  var deskSheet = ss.getSheetByName('DESKDATA');
  if (!deskSheet) throw new Error('DESKDATA sheet not found!');
  return deskSheet;
}

function writeDeskRow_(deskSheet, row, rowData) {
  deskSheet.getRange(row, 1, 1, DESK_COL_COUNT).setValues([rowData]);
}

function saveDesk(deskData, isStagingOnly) {
  ensureConfigSheets();
  var d = normalizeDeskData(deskData);
  var stagingRow = isStagingOnly ? getStagingRow_(d.manager) : requireStagingRow_(d.manager);
  if (isStagingOnly && !stagingRow) {
    return { success: true, message: 'Staging skipped (no manager).', dealNumber: String(d.dealNumber || '') };
  }

  return withSheetLock_(function () {
    var deskSheet = getDeskSheet_();
    var existingDealNum = String(d.dealNumber || '').trim();
    var dealNum;
    var isNewDeal = false;
    if (!existingDealNum) {
      dealNum = getNextDealNumber_(deskSheet);
      isNewDeal = true;
    } else {
      dealNum = existingDealNum;
    }
    var rowData = buildRowData_(d, dealNum);
    writeDeskRow_(deskSheet, stagingRow, rowData);

    if (!isStagingOnly) {
      if (isNewDeal) {
        var lastRow = Math.max(4, deskSheet.getLastRow());
        writeDeskRow_(deskSheet, lastRow + 1, rowData);
        return { success: true, message: 'Deal saved! Deal #', dealNumber: String(dealNum) };
      }
      var existingRow = findDealRow_(deskSheet, dealNum);
      if (existingRow > 0) {
        writeDeskRow_(deskSheet, existingRow, rowData);
        return { success: true, message: 'Deal updated! Deal #', dealNumber: String(dealNum) };
      }
      lastRow = Math.max(4, deskSheet.getLastRow());
      writeDeskRow_(deskSheet, lastRow + 1, rowData);
      return { success: true, message: 'Deal saved! Deal #', dealNumber: String(dealNum) };
    }
    return { success: true, message: 'Staging updated.', dealNumber: String(dealNum) };
  });
}

function assignPrintDealNumber_(deskSheet, deskData) {
  var existingDealNum = String(deskData.dealNumber || '').trim();
  if (!existingDealNum) return String(getNextDealNumber_(deskSheet));
  var base = existingDealNum.split('.')[0];
  return getNextPrintVersion_(deskSheet, base);
}

function getDeskPrintHtmlWithSave(deskData) {
  ensureConfigSheets();
  var d = normalizeDeskData(deskData);
  var stagingRow = requireStagingRow_(d.manager);

  return withSheetLock_(function () {
    var deskSheet = getDeskSheet_();
    var printDealNum = assignPrintDealNumber_(deskSheet, d);
    d.dealNumber = printDealNum;
    d._calc = calculateDeal(d, {});
    var rowData = buildRowData_(d, printDealNum);
    writeDeskRow_(deskSheet, stagingRow, rowData);
    var lastRow = Math.max(4, deskSheet.getLastRow());
    writeDeskRow_(deskSheet, lastRow + 1, rowData);

    var rawHtml = HtmlService.createHtmlOutputFromFile('deskPrint').getContent();
    var finalHtml = injectJson_(rawHtml, '__DESK_DATA_PLACEHOLDER__', d);
    return { htmlStr: finalHtml, dealNumber: printDealNum };
  });
}

function getDeskPrintHtml(deskData) {
  var d = normalizeDeskData(deskData);
  d._calc = calculateDeal(d, {});
  var rawHtml = HtmlService.createHtmlOutputFromFile('deskPrint').getContent();
  return injectJson_(rawHtml, '__DESK_DATA_PLACEHOLDER__', d);
}

function openDeskPrint(deskData) {
  var htmlContent = getDeskPrintHtml(deskData);
  var html = HtmlService.createHtmlOutput(htmlContent)
    .setTitle('Desk Presentation Print')
    .setWidth(920)
    .setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(html, 'Desk Presentation');
}

function searchDeals(query) {
  if (!query) return [];
  var deskSheet = getDeskSheet_();
  var lastRow = deskSheet.getLastRow();
  if (lastRow < 5) return [];
  var width = Math.max(DESK_COL_COUNT, deskSheet.getLastColumn());
  var data = deskSheet.getRange(5, 1, lastRow - 4, width).getValues();
  var q = String(query).trim().toLowerCase();
  var matches = [];
  for (var i = data.length - 1; i >= 0; i--) {
    var desk = rowToDesk_(data[i]);
    var dealNum = String(desk.dealNumber || '').trim();
    var custName = String(desk.customerName || '').trim().toLowerCase();
    var stockNum = String(desk.stockNum || '').trim().toLowerCase();
    var isMatch = dealNum.toLowerCase() === q ||
      dealNum === String(query).trim() ||
      custName.indexOf(q) !== -1 ||
      stockNum.indexOf(q) !== -1;
    if (isMatch) {
      matches.push(desk);
      if (matches.length >= 20) break;
    }
  }
  return matches;
}

function recallDesk(dealNumber) {
  if (!dealNumber) return null;
  var deskSheet = getDeskSheet_();
  var lastRow = deskSheet.getLastRow();
  if (lastRow < 5) return null;
  var width = Math.max(DESK_COL_COUNT, deskSheet.getLastColumn());
  var data = deskSheet.getRange(5, 1, lastRow - 4, width).getValues();
  var target = String(dealNumber).trim();
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][58]).trim() === target) return rowToDesk_(data[i]);
  }
  return null;
}
