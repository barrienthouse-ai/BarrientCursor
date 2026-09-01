/**
 * Read-only helpers against DEALINPUT in the live Geaux Chevrolet workbook.
 * These functions never write DEALINPUT, SUMMARY, LOGDEAL, or any other existing tab.
 */
function SLM_peekDealInput_(dateKey) {
  var daily = SLM_emptyTotals_();
  var monthly = SLM_emptyTotals_();
  var sheet = SLM_existingSheet_(SLM_DEAL_SHEET);
  if (!sheet) {
    return { date: dateKey, month: String(dateKey || '').slice(0, 7), daily: daily, monthly: monthly, rows: 0, available: false };
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 6) {
    return { date: dateKey, month: String(dateKey || '').slice(0, 7), daily: daily, monthly: monthly, rows: 0, available: true };
  }
  var start = Math.max(6, lastRow - 499);
  var height = lastRow - start + 1;
  var values = sheet.getRange(start, 1, height, 27).getValues();
  var month = String(dateKey || '').slice(0, 7);
  var counted = 0;
  for (var i = 0; i < values.length; i++) {
    var rowDate = SLM_dateKeyFast_(values[i][0]);
    if (!rowDate) {
      continue;
    }
    if (!SLM_isRetail_(values[i][3])) {
      continue;
    }
    var dept = SLM_dept_(values[i][4]);
    if (dept !== 'new' && dept !== 'used') {
      continue;
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
  var key = SLM_todayKey_();
  var peek = SLM_peekDealInput_(key);
  SpreadsheetApp.getUi().alert(
    'Read-only peek of DEALINPUT (no existing tabs were changed)\n\n' +
    'Date: ' + key + '\n' +
    'Retail new: ' + peek.daily.newSold + '\n' +
    'Retail used: ' + peek.daily.usedSold + '\n' +
    'Front: ' + peek.daily.frontGross + '\n' +
    'Back: ' + peek.daily.backGross + '\n' +
    'Total: ' + peek.daily.totalGross + '\n\n' +
    'Use Fill from deal log in the recap to copy these into today’s numbers. Traffic is still typed by the manager.'
  );
}
