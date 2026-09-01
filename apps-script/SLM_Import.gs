/**
 * Read-only helpers against DEALINPUT in the live Geaux Chevrolet workbook.
 * These functions never write DEALINPUT, SUMMARY, LOGDEAL, or any other existing tab.
 *
 * DEALINPUT is padded with formulas well past the last real deal (row ~800 of ~12,000).
 * Column A formulas can still look like dates, so the last real deal is the last row
 * that has a parseable date AND a TYPE or DEPT — not merely a date in A.
 */
function SLM_rowLooksLikeDeal_(displayedRow, rawRow) {
  var dateKey = SLM_parseSheetDate_(displayedRow[0]) || SLM_parseSheetDate_(rawRow[0]);
  if (!dateKey) {
    return '';
  }
  var type = String(displayedRow[3] || rawRow[3] || '').trim();
  var dept = String(displayedRow[4] || rawRow[4] || '').trim();
  return type || dept ? dateKey : '';
}

function SLM_lastDealRow_(sheet) {
  var last = sheet.getLastRow();
  if (last < 6) {
    return 5;
  }
  var chunk = 400;
  var end = last;
  while (end >= 6) {
    var start = Math.max(6, end - chunk + 1);
    var height = end - start + 1;
    var displayed = sheet.getRange(start, 1, height, 5).getDisplayValues();
    var raw = sheet.getRange(start, 1, height, 5).getValues();
    for (var i = height - 1; i >= 0; i--) {
      if (SLM_rowLooksLikeDeal_(displayed[i], raw[i])) {
        return start + i;
      }
    }
    end = start - 1;
  }
  return 5;
}

function SLM_peekDealInput_(dateKey) {
  var daily = SLM_emptyTotals_();
  var monthly = SLM_emptyTotals_();
  var sheet = SLM_existingSheet_(SLM_DEAL_SHEET);
  if (!sheet) {
    return { date: dateKey, month: String(dateKey || '').slice(0, 7), daily: daily, monthly: monthly, rows: 0, lastRetailDate: '', available: false };
  }
  var lastDealRow = SLM_lastDealRow_(sheet);
  if (lastDealRow < 6) {
    return { date: dateKey, month: String(dateKey || '').slice(0, 7), daily: daily, monthly: monthly, rows: 0, lastRetailDate: '', available: true };
  }
  var start = 6;
  if (lastDealRow - start + 1 > 6000) {
    start = lastDealRow - 5999;
  }
  var height = lastDealRow - start + 1;
  var values = sheet.getRange(start, 1, height, 27).getValues();
  var displayed = sheet.getRange(start, 1, height, 5).getDisplayValues();
  var month = String(dateKey || '').slice(0, 7);
  var counted = 0;
  var lastRetailDate = '';
  for (var i = 0; i < values.length; i++) {
    var rowDate = SLM_parseSheetDate_(displayed[i][0]) || SLM_parseSheetDate_(values[i][0]);
    if (!rowDate) {
      continue;
    }
    var type = displayed[i][3] || values[i][3];
    if (!SLM_isRetail_(type)) {
      continue;
    }
    var dept = SLM_dept_(displayed[i][4] || values[i][4]);
    if (dept !== 'new' && dept !== 'used') {
      continue;
    }
    if (rowDate > lastRetailDate) {
      lastRetailDate = rowDate;
    }
    var rec = {
      dept: dept,
      front: SLM_roundMoney_(values[i][16]),
      back: SLM_roundMoney_(values[i][25]),
      total: SLM_roundMoney_(values[i][26])
    };
    if (!rec.total && (rec.front || rec.back)) {
      rec.total = SLM_roundMoney_(rec.front + rec.back);
    }
    if (rowDate === dateKey) {
      SLM_addSale_(daily, rec);
      counted += 1;
    }
    if (month && rowDate.indexOf(month) === 0) {
      SLM_addSale_(monthly, rec);
    }
  }
  return {
    date: dateKey,
    month: month,
    daily: daily,
    monthly: monthly,
    rows: counted,
    lastRetailDate: lastRetailDate,
    available: true
  };
}

function SLM_addSale_(bucket, rec) {
  if (rec.dept === 'new') {
    bucket.newSold += 1;
  } else if (rec.dept === 'used') {
    bucket.usedSold += 1;
  } else {
    return;
  }
  bucket.dealCount += 1;
  bucket.frontGross = SLM_roundMoney_(bucket.frontGross + rec.front);
  bucket.backGross = SLM_roundMoney_(bucket.backGross + rec.back);
  bucket.totalGross = SLM_roundMoney_(bucket.totalGross + rec.total);
  bucket.totalSold = bucket.newSold + bucket.usedSold;
}

function SLM_showDealLogPeek() {
  var ui = SpreadsheetApp.getUi();
  var today = SLM_todayKey_();
  var asked = ui.prompt(
    'Peek DEALINPUT',
    'Which date? Examples: 8/31/2026 or 2026-08-31. Leave blank for today (' + today + ').',
    ui.ButtonSet.OK_CANCEL
  );
  if (asked.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  var key = SLM_dateKeyFast_(asked.getResponseText()) || today;
  var peek = SLM_peekDealInput_(key);
  ui.alert(
    'Read-only peek of DEALINPUT (no existing tabs were changed)\n\n' +
    'Date searched: ' + key + '\n' +
    'Retail deals that day: ' + peek.daily.dealCount + '\n' +
    'Retail new: ' + peek.daily.newSold + '\n' +
    'Retail used: ' + peek.daily.usedSold + '\n' +
    'Front: ' + peek.daily.frontGross + '\n' +
    'Back: ' + peek.daily.backGross + '\n' +
    'Total: ' + peek.daily.totalGross + '\n' +
    'Last retail day in DEALINPUT: ' + (peek.lastRetailDate || '(none)') + '\n\n' +
    'If this is still zero on a day you can see in DEALINPUT, replace SLM_Config.gs, SLM_Import.gs, SLM_Api.gs, and SLM_App.html from the latest source.'
  );
}
