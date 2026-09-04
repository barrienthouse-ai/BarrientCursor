/**
 * Read-only helpers against DEALINPUT in the live Geaux Chevrolet workbook.
 * These functions never write DEALINPUT, FLEET CUSTOMERS, SUMMARY, or any other existing tab.
 *
 * Fleet rows are TYPE or DEPT of Fleet / Commercial. Retail rows are ignored.
 */
function FLM_peekDealInput_(dateKey) {
  var key = FLM_dateKeyFast_(dateKey) || FLM_toDateKey_(dateKey);
  var empty = {
    date: key,
    month: key.slice(0, 7),
    daily: FLM_emptyTotals_(),
    monthly: FLM_emptyTotals_(),
    rows: [],
    lastFleetDate: '',
    available: false
  };
  var sheet = FLM_existingSheet_(FLM_DEAL_SHEET);
  if (!sheet || sheet.getLastRow() < 6) {
    return empty;
  }
  var lastRow = Math.min(sheet.getLastRow(), 900);
  var values = sheet.getRange(6, 1, lastRow - 5, 27).getValues();
  var daily = FLM_emptyTotals_();
  var monthly = FLM_emptyTotals_();
  var rows = [];
  var lastFleetDate = '';
  var month = key.slice(0, 7);
  for (var i = 0; i < values.length; i++) {
    var type = values[i][3];
    var dept = values[i][5];
    if (!FLM_isFleet_(type, dept)) {
      continue;
    }
    var dealDate = FLM_dateKeyFast_(values[i][0]);
    if (!dealDate) {
      continue;
    }
    var front = FLM_roundMoney_(values[i][16]);
    var finance = FLM_roundMoney_(values[i][25]);
    var total = FLM_roundMoney_(values[i][26] !== '' && values[i][26] != null ? values[i][26] : front + finance);
    var units = Math.max(1, Math.round(FLM_toNumber_(values[i][8]) || 1));
    if (dealDate > lastFleetDate) {
      lastFleetDate = dealDate;
    }
    if (dealDate === key) {
      daily.dealCount += 1;
      daily.soldDeals += units;
      daily.units += units;
      daily.frontGross = FLM_roundMoney_(daily.frontGross + front);
      daily.financeGross = FLM_roundMoney_(daily.financeGross + finance);
      daily.totalGross = FLM_roundMoney_(daily.totalGross + total);
      rows.push({ date: dealDate, type: type, dept: dept, front: front, finance: finance, total: total, units: units });
    }
    if (dealDate.indexOf(month) === 0) {
      monthly.dealCount += 1;
      monthly.soldDeals += units;
      monthly.units += units;
      monthly.frontGross = FLM_roundMoney_(monthly.frontGross + front);
      monthly.financeGross = FLM_roundMoney_(monthly.financeGross + finance);
      monthly.totalGross = FLM_roundMoney_(monthly.totalGross + total);
    }
  }
  return {
    date: key,
    month: month,
    daily: daily,
    monthly: monthly,
    rows: rows,
    lastFleetDate: lastFleetDate,
    available: true
  };
}

function FLM_showDealLogPeek() {
  var peek = FLM_peekDealInput_(FLM_todayKey_());
  var daily = peek.daily;
  SpreadsheetApp.getUi().alert(
    'DEALINPUT fleet peek for ' + peek.date + '\n\n' +
    'Sold units: ' + daily.soldDeals + '\n' +
    'Front: ' + daily.frontGross + '\n' +
    'Finance: ' + daily.financeGross + '\n' +
    'Total: ' + daily.totalGross + '\n\n' +
    'Last fleet day: ' + (peek.lastFleetDate || '(none)') + '\n' +
    'DEALINPUT was not written.'
  );
}
