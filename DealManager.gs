/**
 * GEAUX CHEVROLET — DEAL LOG MANAGER
 * SPEED PASS — same DEALINPUT paste/formula rules.
 * Menus live in Code.gs (GEAUX TOOLS → Deal Log). Do not add onOpen() here.
 * LOGDEAL = input form. DEALINPUT = sold-deal log (headers row 5, data row 6+).
 *
 * Live F&I products (do not insert columns; Z/AA stay formulas):
 *   B15 AG/FRONT → O (removed; blank)
 *   B16 FRONT → P     B17 PART → R     B18 MBI → S     B19 GAP → T
 *   B20 PPM → U       B21 UVP → V      B22 GPS → W     B23 SAFE-SHIELD → X
 *   B24 PAINT/etch → Y
 *   B39 WINDSHIELD → DA   B40 THEFT → DT
 *   Q = O+P   Z = SUM(R:Y)+DA+DT   AA = Q+Z
 *   EB1 is trade O/U — never overwrite.
 */

function OPENDEALMANAGER() {
  const html = HtmlService.createTemplateFromFile('dealDialog')
      .evaluate().setWidth(500).setHeight(600).setTitle('Deal Manager');
  SpreadsheetApp.getUi().showSidebar(html);
}

function OPENLOGDEAL() {
  ensureLogDealProductLayout_();
  var raw = HtmlService.createHtmlOutputFromFile('logDealDialog').getContent();
  var html = HtmlService.createHtmlOutput(applyLogDealDialogPatches_(raw))
      .setWidth(1400).setHeight(900).setTitle('Deal Log Entry');
  SpreadsheetApp.getUi().showModalDialog(html, 'Deal Log Entry');
}

function applyLogDealDialogPatches_(html) {
  html = String(html || '');
  if (html.indexOf('<option>FLEET</option>') === -1) {
    html = html.replace('<option>WHSL</option>', '<option>WHSL</option>\n            <option>FLEET</option>');
  }
  html = html.replace('>New / Used / Whsl<', '>New / Used / Whsl / Fleet<');
  return html;
}

function getLogDealDropdowns() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var setup = ss.getSheetByName('SETUP');
  if (!setup) return { salesReps: [], managers: [], salesRoles: {} };

  var allData   = setup.getRange(1, 1, setup.getLastRow(), 2).getValues();
  var salesReps  = [];
  var salesRoles = {};
  var inSalesRep = false;
  for (var i = 0; i < allData.length; i++) {
    var a = (allData[i][0] || '').toString().trim();
    var b = (allData[i][1] || '').toString().trim();
    if (a === 'SALES REP') { inSalesRep = true; continue; }
    if (a === 'ENTRY TYPE:') { inSalesRep = false; continue; }
    if (inSalesRep && a) {
      salesReps.push(a);
      if (b) salesRoles[a] = b;
    }
  }

  var managers = [];
  var mgrData  = setup.getRange(57, 1, 7, 1).getValues();
  for (var j = 0; j < mgrData.length; j++) {
    var name = (mgrData[j][0] || '').toString().trim();
    if (name) managers.push(name);
  }

  return { salesReps: salesReps, managers: managers, salesRoles: salesRoles };
}

function getVehicleByStockForLog(stockNo) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var inv = ss.getSheetByName('INV');
  if (!inv) return null;

  var lastRow = inv.getLastRow();
  if (lastRow < 6) return null;

  var data = inv.getRange(6, 1, lastRow - 5, 17).getValues();
  var sn   = stockNo.toString().trim().toUpperCase();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if ((row[0] || '').toString().trim().toUpperCase() === sn) {
      var hitlist = ss.getSheetByName('HITLIST');
      var threshold = 0;
      if (hitlist) {
        var hData = hitlist.getRange(10, 1, Math.min(hitlist.getLastRow()-9, 500), 9).getValues();
        for (var j = 0; j < hData.length; j++) {
          if ((hData[j][0] || '').toString().trim().toUpperCase() === sn) {
            threshold = hData[j][8] || 0;
            break;
          }
        }
      }
      return {
        year:          row[2]  || '',
        make:          row[3]  || '',
        model:         row[4]  || '',
        vin:           row[16] || '',
        hitlistOnList: threshold > 0,
        hitlistAmount: threshold > 0 ? threshold : 0
      };
    }
  }
  return null;
}

function getLogSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DEALINPUT');
}
function getInputSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LOGDEAL');
}

var FIELD_MAPPING = [
  { input: 'B2',  logCol: 0   },
  { input: 'B3',  logCol: 1   },
  { input: 'B4',  logCol: 3   },
  { input: 'B5',  logCol: 4   },
  { input: 'B6',  logCol: 5   },
  { input: 'B7',  logCol: 6   },
  { input: 'B8',  logCol: 7   },
  { input: 'B9',  logCol: 8   },
  { input: 'B10', logCol: 9   },
  { input: 'B11', logCol: 10  },
  { input: 'B12', logCol: 11  },
  { input: 'B13', logCol: 12  },
  { input: 'B14', logCol: 13  },
  { input: 'B15', logCol: 14  },
  { input: 'B16', logCol: 15  },
  { input: 'B17', logCol: 17  },
  { input: 'B18', logCol: 18  },
  { input: 'B19', logCol: 19  },
  { input: 'B20', logCol: 20  },
  { input: 'B21', logCol: 21  },
  { input: 'B22', logCol: 22  },
  { input: 'B23', logCol: 23  },
  { input: 'B24', logCol: 24  },
  { input: 'B25', logCol: 27  },
  { input: 'B26', logCol: 28  },
  { input: 'B27', logCol: 29  },
  { input: 'B28', logCol: 30  },
  { input: 'B29', logCol: 31  },
  { input: 'B30', logCol: 32  },
  { input: 'B31', logCol: 33  },
  { input: 'B32', logCol: 34  },
  { input: 'B33', logCol: 35  },
  { input: 'B34', logCol: 36  },
  { input: 'B35', logCol: 37  },
  { input: 'B36', logCol: 38  },
  { input: 'B37', logCol: 39  },
  { input: 'B38', logCol: 41  },
  { input: 'E30', logCol: 42  },
  { input: 'E31', logCol: 43  },
  { input: 'E32', logCol: 44  },
  { input: 'E33', logCol: 45  },
  { input: 'E34', logCol: 46  },
  { input: 'E35', logCol: 47  },
  { input: 'E36', logCol: 48  },
  { input: 'E37', logCol: 49  },
  { input: 'E38', logCol: 51  },
  { input: 'E5',  logCol: 52  },
  { input: 'E6',  logCol: 53  },
  { input: 'E7',  logCol: 54  },
  { input: 'E8',  logCol: 55  },
  { input: 'E9',  logCol: 56  },
  { input: 'E10', logCol: 57  },
  { input: 'E11', logCol: 58  },
  { input: 'E12', logCol: 59  },
  { input: 'E13', logCol: 60  },
  { input: 'E14', logCol: 61  },
  { input: 'E15', logCol: 62  },
  { input: 'E16', logCol: 63  },
  { input: 'E17', logCol: 64  },
  { input: 'E18', logCol: 65  },
  { input: 'G4',  logCol: 72  },
  { input: 'E4',  logCol: 73  },
  { input: 'J30', logCol: 78  },
  { input: 'J31', logCol: 79  },
  { input: 'H16', logCol: 127 },
  { input: 'H17', logCol: 128 },
  { input: 'H18', logCol: 129 },
  { input: 'H19', logCol: 130 },
  { input: 'B39', logCol: 104 },
  { input: 'B40', logCol: 123 }
];

function safeVal(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "MM/dd/yyyy");
  }
  return val;
}

function locateDeals(query) {
  if (!query) return [];
  query = query.toString().toLowerCase().trim();

  var logSheet = getLogSheet();
  if (!logSheet) throw new Error("Sheet 'DEALINPUT' not found.");

  var lastRow = logSheet.getLastRow();
  if (lastRow < 6) return [];

  var numRows = lastRow - 5;
  var tz = Session.getScriptTimeZone();
  var matches = [];
  var data = logSheet.getRange(6, 1, numRows, 14).getValues();

  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];

    var dealNo    = (row[1]  || '').toString().trim();
    var stock     = (row[7]  || '').toString().trim();
    var firstName = (row[12] || '').toString().trim();
    var lastName  = (row[13] || '').toString().trim();
    var fullName  = (firstName + ' ' + lastName).trim();

    if (!dealNo && !stock && !firstName && !lastName) continue;

    if (dealNo.toLowerCase().includes(query)    ||
        stock.toLowerCase().includes(query)     ||
        firstName.toLowerCase().includes(query) ||
        lastName.toLowerCase().includes(query)  ||
        fullName.toLowerCase().includes(query)) {

      var rawDate = row[0];
      var dateStr = rawDate instanceof Date
        ? Utilities.formatDate(rawDate, tz, "MM/dd/yyyy")
        : (rawDate || '').toString();

      matches.push({
        rowIndex:  i + 6,
        dealNo:    dealNo,
        stock:     stock,
        firstName: firstName,
        lastName:  lastName,
        date:      dateStr
      });

      if (matches.length >= 50) break;
    }
  }
  return matches;
}

function writeMappedFieldsToLogDeal_(sheet, rowData) {
  var byCol = {};
  for (var m = 0; m < FIELD_MAPPING.length; m++) {
    var map = FIELD_MAPPING[m];
    var parts = map.input.match(/^([A-Z]+)(\d+)$/);
    if (!parts) continue;
    var col = parts[1];
    var row = parseInt(parts[2], 10);
    if (!byCol[col]) byCol[col] = [];
    byCol[col].push({ row: row, val: safeVal(rowData[map.logCol]) });
  }

  var cols = Object.keys(byCol);
  for (var c = 0; c < cols.length; c++) {
    var colLetter = cols[c];
    var cells = byCol[colLetter];
    cells.sort(function(a, b) { return a.row - b.row; });
    var i = 0;
    while (i < cells.length) {
      var startRow = cells[i].row;
      var vals = [[cells[i].val]];
      var j = i + 1;
      while (j < cells.length && cells[j].row === cells[j - 1].row + 1) {
        vals.push([cells[j].val]);
        j++;
      }
      var endRow = cells[j - 1].row;
      sheet.getRange(colLetter + startRow + ':' + colLetter + endRow).setValues(vals);
      i = j;
    }
  }
}

function recallDealToForm(rowIndex) {
  var logSheet   = getLogSheet();
  var inputSheet = getInputSheet();

  if (!logSheet)   throw new Error("Sheet 'DEALINPUT' not found.");
  if (!inputSheet) throw new Error("Sheet 'LOGDEAL' not found.");

  var rowData = logSheet.getRange(rowIndex, 1, 1, 133).getValues()[0];
  writeMappedFieldsToLogDeal_(inputSheet, rowData);
  return true;
}

function recallDealForDialog(rowIndex) {
  recallDealToForm(rowIndex);
  return getRecalledFormData();
}

var PROTECTED_INDICES = [2,16,25,26,40,50,67,69,71,77,80,82,83,84,85,86,87,88,
  89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,105,106,107,108,109,110,111,
  112,113,115,116,117,118,119,120,121,122,124,125,126];

var PROTECTED_INDEX_SET = (function() {
  var set = {};
  for (var i = 0; i < PROTECTED_INDICES.length; i++) set[PROTECTED_INDICES[i]] = true;
  return set;
})();

function copyLogDealRowTo_(destSheet, targetRow) {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheetByName('LOGDEAL');
  var sourceRange = sourceSheet.getRange('A1:EC1');
  var numCols     = sourceRange.getNumColumns();
  var destRange   = destSheet.getRange(targetRow, 1, 1, numCols);

  sourceRange.copyTo(destRange);

  var staticValues = sourceRange.getValues()[0];
  var start = null;
  for (var i = 0; i <= numCols; i++) {
    var isProt = (i < numCols) && PROTECTED_INDEX_SET[i];
    if (i < numCols && !isProt) {
      if (start === null) start = i;
    } else if (start !== null) {
      var width = i - start;
      destSheet.getRange(targetRow, start + 1, 1, width)
               .setValues([staticValues.slice(start, start + width)]);
      start = null;
    }
  }
}

function formVal_(d, key) {
  if (!(key in d)) return undefined;
  var val = d[key];
  return (val === '' || val === null || val === undefined) ? '' : val;
}

function colVals_(d, keys) {
  var out = [];
  for (var i = 0; i < keys.length; i++) {
    var v = formVal_(d, keys[i]);
    out.push([v === undefined ? '' : v]);
  }
  return out;
}

function logDealFieldAliases_(d) {
  var out = {};
  if (!d) return out;
  for (var k in d) {
    if (Object.prototype.hasOwnProperty.call(d, k)) out[k] = d[k];
  }
  if (out.etch !== undefined && String(out.etch) !== '') out.paint = out.etch;
  if ((out.uvp === undefined || out.uvp === '') && out.uvpProd !== undefined) out.uvp = out.uvpProd;
  if ((out.uvp === undefined || out.uvp === '') && out.key !== undefined) out.uvp = out.key;
  if ((out.gps === undefined || out.gps === '') && out.starguard !== undefined) out.gps = out.starguard;
  if ((out.gps === undefined || out.gps === '') && out.tire !== undefined) out.gps = out.tire;
  if ((out.ceramic === undefined || out.ceramic === '') && out.safeshield !== undefined) out.ceramic = out.safeshield;
  if ((out.spiff2 === undefined || out.spiff2 === '') && out.spiff2b !== undefined) out.spiff2 = out.spiff2b;
  return out;
}

function writeFormToSheet_(s, d) {
  d = logDealFieldAliases_(d);

  s.getRange('B2:B40').clearContent();
  s.getRange('E4:E38').clearContent();
  s.getRange('G4').clearContent();
  s.getRange('H16:H21').clearContent();
  s.getRange('J30:J31').clearContent();

  s.getRange('B2:B38').setValues(colVals_(d, [
    'dealDate', 'dealNo', 'saleType', 'newUsed', 'sales1', 'sales2', 'stockNo',
    'vehYear', 'vehMake', 'vehModel', 'vehVin',
    'custFirst', 'custLast',
    '', 'frontGross', 'participation', 'warranty', 'gap', 'maint', 'uvp', 'gps',
    'ceramic', 'paint', 'downPayment', 'financeMgr', 'salesMgr', 'lienholder', 'totalFinanced',
    'trade1Stk', 'trade1Year', 'trade1Make', 'trade1Model', 'trade1Vin', 'trade1Miles',
    'trade1Acv', 'trade1Allow', 'trade1Title'
  ]));

  var rdrType = formVal_(d, 'rdrType');
  var rdrDate = formVal_(d, 'rdrDate');
  if (rdrType !== undefined) s.getRange('E4').setValue(rdrType);
  if (rdrDate !== undefined) s.getRange('G4').setValue(rdrDate);

  var t1Acv   = parseFloat(d['trade1Acv']   || 0);
  var t1Allow = parseFloat(d['trade1Allow'] || 0);
  var t2Acv   = parseFloat(d['trade2Acv']   || 0);
  var t2Allow = parseFloat(d['trade2Allow'] || 0);
  var weowes   = parseFloat(d['weowes']   || 0);
  var commCost = parseFloat(d['commCost'] || 0);
  var sp = formVal_(d, 'salesPrice');
  var wo = formVal_(d, 'weowes');
  var cc = formVal_(d, 'commCost');
  var dc = formVal_(d, 'dlrCash');

  s.getRange('H16:H21').setValues([
    [sp !== undefined ? sp : ''],
    [wo !== undefined ? wo : ''],
    [cc !== undefined ? cc : ''],
    [dc !== undefined ? dc : ''],
    [(t1Acv - t1Allow) + (t2Acv - t2Allow)],
    [weowes + commCost]
  ]);

  s.getRange('E30:E38').setValues(colVals_(d, [
    'trade2Stk', 'trade2Year', 'trade2Make', 'trade2Model', 'trade2Vin',
    'trade2Miles', 'trade2Acv', 'trade2Allow', 'trade2Title'
  ]));

  s.getRange('E5:E19').setValues(colVals_(d, [
    'rebate1Submitted', 'rebate1Code', 'rebate1Approval',
    'rebate2Submitted', 'rebate2Code', 'rebate2Approval',
    'rebate3Submitted', 'rebate3Code', 'rebate3Approval',
    'rebate4Submitted', 'rebate4Code', 'rebate4Approval',
    'rebate5Submitted', 'rebate5Code', 'rebate5Approval'
  ]));

  s.getRange('J30:J31').setValues(colVals_(d, ['spiff1', 'spiff2']));

  var windshield = formVal_(d, 'windshield');
  var theft = formVal_(d, 'theft');
  s.getRange('B39').setValue(windshield === undefined ? '' : windshield);
  s.getRange('B40').setValue(theft === undefined ? '' : theft);
  s.getRange('DA1').setFormula('=$B$39');
  s.getRange('DT1').setFormula('=$B$40');

  SpreadsheetApp.flush();
}

function addDeal(dealNo, formData) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName('DEALINPUT');
  var frmSheet = ss.getSheetByName('LOGDEAL');

  if (!logSheet) throw new Error("Sheet 'DEALINPUT' not found.");
  if (!frmSheet) throw new Error("Sheet 'LOGDEAL' not found.");

  dealNo = (dealNo || '').toString().trim();
  if (!dealNo) throw new Error('Deal Number is required to add a deal.');

  ensureLogDealWindshieldLayout_();
  if (formData) writeFormToSheet_(frmSheet, formData);
  else {
    frmSheet.getRange('B3').setValue(dealNo);
    SpreadsheetApp.flush();
  }

  var existing = locateDeals(dealNo);
  if (existing.find(function(m) { return m.dealNo.toString() === dealNo; })) {
    throw new Error('Deal #' + dealNo + ' already exists. Use Update Deal instead.');
  }

  var lastRowInA = logSheet.getRange('A' + logSheet.getMaxRows())
                           .getNextDataCell(SpreadsheetApp.Direction.UP).getRow();
  var targetRow  = lastRowInA + 1;

  copyLogDealRowTo_(logSheet, targetRow);

  return 'Deal #' + dealNo + ' added successfully (row ' + targetRow + ').';
}

function updateDeal(dealNo, formData) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName('DEALINPUT');
  var frmSheet = ss.getSheetByName('LOGDEAL');

  if (!logSheet) throw new Error("Sheet 'DEALINPUT' not found.");
  if (!frmSheet) throw new Error("Sheet 'LOGDEAL' not found.");

  dealNo = (dealNo || '').toString().trim();
  if (!dealNo) throw new Error('Deal Number is required to update a deal.');

  var existing = locateDeals(dealNo);
  var match = existing.find(function(m) { return m.dealNo.toString() === dealNo; });
  if (!match) throw new Error('Deal #' + dealNo + ' not found. Use Add Deal instead.');

  ensureLogDealWindshieldLayout_();
  if (formData) writeFormToSheet_(frmSheet, formData);
  else {
    frmSheet.getRange('B3').setValue(dealNo);
    SpreadsheetApp.flush();
  }

  copyLogDealRowTo_(logSheet, match.rowIndex);

  return 'Deal #' + dealNo + ' updated successfully (row ' + match.rowIndex + ').';
}

function getRecalledFormData() {
  var s  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LOGDEAL');
  if (!s) throw new Error("Sheet 'LOGDEAL' not found.");
  var tz = Session.getScriptTimeZone();
  function fmt(val) {
    if (val instanceof Date) return Utilities.formatDate(val, tz, 'MM/dd/yyyy');
    return (val === null || val === undefined) ? '' : val.toString();
  }

  var b = s.getRange('B2:B38').getValues();
  var e = s.getRange('E4:E38').getValues();
  var g4 = s.getRange('G4').getValue();
  var h = s.getRange('H16:H19').getValues();
  var j = s.getRange('J30:J31').getValues();
  var paintVal = fmt(b[22][0]);

  return {
    date:               fmt(b[0][0]),
    dealNo:             fmt(b[1][0]),
    saleType:           fmt(b[2][0]),
    newUsed:            fmt(b[3][0]),
    sales1:             fmt(b[4][0]),
    sales2:             fmt(b[5][0]),
    rdrType:            fmt(e[0][0]),
    rdrDate:            fmt(g4),
    stock:              fmt(b[6][0]),
    year:               fmt(b[7][0]),
    make:               fmt(b[8][0]),
    model:              fmt(b[9][0]),
    vin:                fmt(b[10][0]),
    custFirst:          fmt(b[11][0]),
    custLast:           fmt(b[12][0]),
    frontGross:         fmt(b[14][0]),
    participation:      fmt(b[15][0]),
    warranty:           fmt(b[16][0]),
    gap:                fmt(b[17][0]),
    maint:              fmt(b[18][0]),
    uvp:                fmt(b[19][0]),
    gps:                fmt(b[20][0]),
    ceramic:            fmt(b[21][0]),
    paint:              paintVal,
    etch:               paintVal,
    windshield:         fmt(s.getRange('B39').getValue()),
    theft:              fmt(s.getRange('B40').getValue()),
    downPayment:        fmt(b[23][0]),
    financeMgr:         fmt(b[24][0]),
    salesMgr:           fmt(b[25][0]),
    lienholder:         fmt(b[26][0]),
    totalFinanced:      fmt(b[27][0]),
    salesPrice:         fmt(h[0][0]),
    weowes:             fmt(h[1][0]),
    commCost:           fmt(h[2][0]),
    dlrCash:            fmt(h[3][0]),
    trade1Stk:          fmt(b[28][0]),
    trade1Year:         fmt(b[29][0]),
    trade1Make:         fmt(b[30][0]),
    trade1Model:        fmt(b[31][0]),
    trade1Vin:          fmt(b[32][0]),
    trade1Miles:        fmt(b[33][0]),
    trade1Acv:          fmt(b[34][0]),
    trade1Allow:        fmt(b[35][0]),
    trade1Title:        fmt(b[36][0]),
    trade2Stk:          fmt(e[26][0]),
    trade2Year:         fmt(e[27][0]),
    trade2Make:         fmt(e[28][0]),
    trade2Model:        fmt(e[29][0]),
    trade2Vin:          fmt(e[30][0]),
    trade2Miles:        fmt(e[31][0]),
    trade2Acv:          fmt(e[32][0]),
    trade2Allow:        fmt(e[33][0]),
    trade2Title:        fmt(e[34][0]),
    rebate1Submitted:   fmt(e[1][0]),
    rebate1Code:        fmt(e[2][0]),
    rebate1Approval:    fmt(e[3][0]),
    rebate2Submitted:   fmt(e[4][0]),
    rebate2Code:        fmt(e[5][0]),
    rebate2Approval:    fmt(e[6][0]),
    rebate3Submitted:   fmt(e[7][0]),
    rebate3Code:        fmt(e[8][0]),
    rebate3Approval:    fmt(e[9][0]),
    rebate4Submitted:   fmt(e[10][0]),
    rebate4Code:        fmt(e[11][0]),
    rebate4Approval:    fmt(e[12][0]),
    rebate5Submitted:   fmt(e[13][0]),
    rebate5Code:        fmt(e[14][0]),
    rebate5Approval:    fmt(e[15][0]),
    spiff1:             fmt(j[0][0]),
    spiff2:             fmt(j[1][0])
  };
}

function clearForm() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("LOGDEAL");
  if (!sheet) throw new Error("Sheet 'LOGDEAL' not found.");

  sheet.getRange("E2:E38").clearContent();
  sheet.getRange("B2:B40").clearContent();
  sheet.getRange("H16:H20").clearContent();
  sheet.getRange("H36").clearContent();
  sheet.getRange("G4").clearContent();
  sheet.getRange("F5").clearContent();
  sheet.getRange("F8").clearContent();
  sheet.getRange("F11").clearContent();
  sheet.getRange("F14").clearContent();
  sheet.getRange("F17").clearContent();
  sheet.getRange("J30").clearContent();
  sheet.getRange("J31").clearContent();
  sheet.getRange('G30').setValue('=IF(J24=0,0,MAX(J24:J26))');
  sheet.getRange('G31').setValue('=IF(K24=0,0,MAX(K24:K26))');
  sheet.getRange('F36').setValue('=E36-E37');
  sheet.getRange('C37').setValue('=B36-B37');
  sheet.getRange('C17').setValue('=B16');
  sheet.getRange('C19').setValue('=SUM(B17:B24,B39,B40)');
  sheet.getRange('H30').setValue('=IF($B$5="USED",(IF(C6="ASM", 0.3, 0)+IF(AND(C6="SALES", $H$24<$J$18), 0.25, 0)+IF(AND(C6="SALESN", $H$24<$J$18), 0.25, 0)+IF(AND(C6="SALES", $H$24>=$J$18),0.3,0)+IF(AND(C6="SALESN", $H$24>=$J$18),0.3,0)),0)+IF($B$5="NEW",(IF(C6="ASM", 0.3, 0)+IF(AND(C6="SALES", $H$24<$J$17), 0.25, 0)+IF(AND(C6="SALESN", $H$24<$J$17), 0.25, 0)+IF(AND(C6="SALES", $H$24>=$J$17),0.3,0)+IF(AND(C6="SALESN", $H$24>=$J$17),0.3,0)),0)');
  sheet.getRange('H31').setValue('=IF($B$5="USED",(IF(C7="ASM", 0.3, 0)+IF(AND(C7="SALES", $H$24<$J$18), 0.25, 0)+IF(AND(C7="SALESN", $H$24<$J$18), 0.25, 0)+IF(AND(C7="SALES", $H$24>=$J$18),0.3,0)+IF(AND(C7="SALESN", $H$24>=$J$18),0.3,0)),0)+IF($B$5="NEW",(IF(C7="ASM", 0.3, 0)+IF(AND(C7="SALES", $H$24<$J$17), 0.25, 0)+IF(AND(C7="SALESN", $H$24<$J$17), 0.25, 0)+IF(AND(C7="SALES", $H$24>=$J$17),0.3,0)+IF(AND(C7="SALESN", $H$24>=$J$17),0.3,0)),0)');
  sheet.getRange('H20').setValue('=(C37+F36)');
  sheet.getRange('H21').setValue('=SUM(H17:H18)');
  sheet.getRange('H22').setValue('=0');
  sheet.getRange('H24').setValue('=H16-H21+H20+H22');
  sheet.getRange('H25').setValue('=H24-H23');
  sheet.getRange('J24').setValue('=H30*H25');
  sheet.getRange('J25').setValue('200');
  sheet.getRange('J26').setValue('=IFERROR(INDEX(HITLIST!$I$23:$I,MATCH($B$8,HITLIST!$A$23:$A,0)),)');
  sheet.getRange('K24').setValue('=H25*H31');
  sheet.getRange('K25').setValue('200');
  sheet.getRange('K26').setValue('=IFERROR(INDEX(HITLIST!$I$23:$I,MATCH($B$8,HITLIST!$A$23:$A,0)),)');
  sheet.getRange('F19').setValue('=SUM($F$17,$F$14,$F$10,$F$11,$F$8,$F$5)');
  ensureLogDealProductLayout_();
}

function ensureLogDealWindshieldLayout_() {
  ensureLogDealProductLayout_();
}

function ensureLogDealProductLayout_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logDeal = ss.getSheetByName('LOGDEAL');
  var dealInput = ss.getSheetByName('DEALINPUT');
  if (logDeal) {
    logDeal.getRange('A18').setValue('MBI');
    logDeal.getRange('A20').setValue('MAINT');
    logDeal.getRange('A21').setValue('UVP');
    logDeal.getRange('A22').setValue('GPS');
    logDeal.getRange('A23').setValue('SAFE-SHIELD');
    logDeal.getRange('A24').setValue('PAINT');
    logDeal.getRange('A39').setValue('WINDSHIELD');
    logDeal.getRange('A40').setValue('THEFT');
    logDeal.getRange('C17').setFormula('=B16');
    logDeal.getRange('C19').setFormula('=SUM(B17:B24,B39,B40)');
    logDeal.getRange('H22').setFormula('=0');
    logDeal.getRange('DA1').setFormula('=$B$39');
    logDeal.getRange('DT1').setFormula('=$B$40');
    logDeal.getRange('Z1').setFormula('=SUM(R1:Y1)+DA1+DT1');
    logDeal.getRange('B5').setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(['NEW', 'USED', 'WHSL', 'FLEET'], true)
        .setAllowInvalid(true)
        .build()
    );
  }
  if (dealInput) {
    dealInput.getRange(5, 19).setValue('MBI');
    dealInput.getRange(5, 22).setValue('UVP');
    dealInput.getRange(5, 23).setValue('GPS');
    dealInput.getRange(5, 24).setValue('SAFE-SHIELD');
    dealInput.getRange(5, 25).setValue('PAINT');
    dealInput.getRange(5, 105).setValue('WINDSHIELD');
    dealInput.getRange(5, 124).setValue('THEFT');
  }
}
