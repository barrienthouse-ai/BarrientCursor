/**
 * Read-only helpers against DEALINPUT in the live Geaux Chevrolet workbook.
 * These functions never write DEALINPUT, SUMMARY, LOGDEAL, or any other existing tab.
 *
 * DEALINPUT is padded with formulas well past the last real deal (row ~800 of ~12,000).
 * Never walk that formula tail: TYPE/DEPT go blank after the last typed deal.
 * Cache the last deal row, then read only the selected day's cells.
 */
var SLM_LAST_DEAL_CACHE_KEY_ = 'SLM_lastDealRow';
var SLM_PEEK_CACHE_PREFIX_ = 'SLM_p2_';

function SLM_cacheGet_(key) {
  try {
    return CacheService.getScriptCache().get(key);
  } catch (ignoreCache) {
    return null;
  }
}

function SLM_cachePut_(key, value, seconds) {
  try {
    CacheService.getScriptCache().put(key, String(value), seconds || 300);
  } catch (ignoreCache) {}
}

function SLM_cachedLastDealRow_() {
  var raw = SLM_cacheGet_(SLM_LAST_DEAL_CACHE_KEY_);
  if (!raw) {
    try {
      raw = PropertiesService.getScriptProperties().getProperty(SLM_LAST_DEAL_CACHE_KEY_);
    } catch (ignoreProps) {
      raw = null;
    }
  }
  var row = Number(raw);
  return row >= 6 ? row : 0;
}

function SLM_storeLastDealRow_(row) {
  if (!(row >= 6)) {
    return;
  }
  SLM_cachePut_(SLM_LAST_DEAL_CACHE_KEY_, row, 21600);
  try {
    PropertiesService.getScriptProperties().setProperty(SLM_LAST_DEAL_CACHE_KEY_, String(row));
  } catch (ignoreProps) {}
}

function SLM_lastFilledIndex_(rows) {
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0] || '').trim() || String(rows[i][1] || '').trim()) {
      return i;
    }
  }
  return -1;
}

function SLM_scanTypeDept_(sheet, start, end) {
  if (end < start) {
    return 0;
  }
  var height = end - start + 1;
  var values = sheet.getRange(start, 4, height, 2).getValues();
  var idx = SLM_lastFilledIndex_(values);
  return idx < 0 ? 0 : start + idx;
}

function SLM_extendLastDealFrom_(sheet, startRow, lastRow) {
  var found = startRow >= 6 ? startRow : 5;
  var cursor = Math.max(6, startRow);
  var size = 80;
  while (cursor <= lastRow) {
    var end = Math.min(lastRow, cursor + size - 1);
    var hit = SLM_scanTypeDept_(sheet, cursor, end);
    if (!hit) {
      break;
    }
    found = hit;
    if (hit < end) {
      break;
    }
    cursor = hit + 1;
    size = Math.min(size * 2, 400);
  }
  return found;
}

function SLM_lastDealRow_(sheet) {
  var last = sheet.getLastRow();
  if (last < 6) {
    return 5;
  }
  var cached = SLM_cachedLastDealRow_();
  var found = 5;
  if (cached >= 6 && cached <= last) {
    var probeStart = Math.max(6, cached - 2);
    var probeEnd = Math.min(last, cached + 80);
    var probe = SLM_scanTypeDept_(sheet, probeStart, probeEnd);
    if (probe >= 6) {
      found = probe;
      if (probe === probeEnd) {
        found = SLM_extendLastDealFrom_(sheet, probe, last);
      }
    } else if (cached > 6) {
      found = SLM_scanTypeDept_(sheet, 6, cached);
    }
  }
  if (found < 6) {
    found = SLM_extendLastDealFrom_(sheet, 6, last);
  }
  if (found >= 6) {
    SLM_storeLastDealRow_(found);
  }
  return found;
}

function SLM_lastRetailMeta_(sheet, lastDealRow) {
  var start = Math.max(6, lastDealRow - 120);
  var height = lastDealRow - start + 1;
  var dates = sheet.getRange(start, 1, height, 1).getValues();
  var marks = sheet.getRange(start, 4, height, 2).getValues();
  for (var i = height - 1; i >= 0; i--) {
    if (!SLM_isRetail_(marks[i][0])) {
      continue;
    }
    var dept = SLM_dept_(marks[i][1]);
    if (dept !== 'new' && dept !== 'used') {
      continue;
    }
    return { date: SLM_parseSheetDate_(dates[i][0]), row: start + i };
  }
  return { date: '', row: lastDealRow };
}

function SLM_daySpan_(sheet, dateKey, lastDealRow) {
  var start = 6;
  var height = lastDealRow - start + 1;
  if (height > 400) {
    start = Math.max(6, lastDealRow - 399);
    height = lastDealRow - start + 1;
  }
  var dates = sheet.getRange(start, 1, height, 1).getValues();
  var first = -1;
  var last = -1;
  for (var i = 0; i < dates.length; i++) {
    if (SLM_parseSheetDate_(dates[i][0]) === dateKey) {
      if (first < 0) {
        first = i;
      }
      last = i;
    }
  }
  if (first >= 0) {
    return { start: start + first, end: start + last };
  }
  if (start === 6) {
    return null;
  }
  var earlierHeight = start - 6;
  var earlier = sheet.getRange(6, 1, earlierHeight, 1).getValues();
  first = -1;
  last = -1;
  for (var j = 0; j < earlier.length; j++) {
    if (SLM_parseSheetDate_(earlier[j][0]) === dateKey) {
      if (first < 0) {
        first = j;
      }
      last = j;
    }
  }
  if (first < 0) {
    return null;
  }
  return { start: 6 + first, end: 6 + last };
}

function SLM_sumDayRows_(sheet, span) {
  var daily = SLM_emptyTotals_();
  if (!span) {
    return daily;
  }
  var height = span.end - span.start + 1;
  var types = sheet.getRange(span.start, 4, height, 2).getValues();
  var front = sheet.getRange(span.start, 17, height, 1).getValues();
  var fin = sheet.getRange(span.start, 26, height, 2).getValues();
  for (var i = 0; i < height; i++) {
    if (!SLM_isRetail_(types[i][0])) {
      continue;
    }
    var dept = SLM_dept_(types[i][1]);
    if (dept !== 'new' && dept !== 'used') {
      continue;
    }
    var rec = {
      dept: dept,
      front: SLM_roundMoney_(front[i][0]),
      back: SLM_roundMoney_(fin[i][0]),
      total: SLM_roundMoney_(fin[i][1])
    };
    if (!rec.total && (rec.front || rec.back)) {
      rec.total = SLM_roundMoney_(rec.front + rec.back);
    }
    SLM_addSale_(daily, rec);
  }
  return daily;
}

function SLM_emptyPeek_(dateKey, available) {
  return {
    date: dateKey,
    month: String(dateKey || '').slice(0, 7),
    daily: SLM_emptyTotals_(),
    monthly: SLM_emptyTotals_(),
    rows: 0,
    lastRetailDate: '',
    available: available,
    ms: 0
  };
}

function SLM_peekDealInput_(dateKey, options) {
  var started = Date.now();
  var skipCache = options && options.skipCache;
  var cacheKey = SLM_PEEK_CACHE_PREFIX_ + String(dateKey || '');
  if (!skipCache && dateKey) {
    var cached = SLM_cacheGet_(cacheKey);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        parsed.ms = Date.now() - started;
        parsed.cached = true;
        return parsed;
      } catch (ignoreParse) {}
    }
  }
  var sheet = SLM_existingSheet_(SLM_DEAL_SHEET);
  if (!sheet) {
    return SLM_emptyPeek_(dateKey, false);
  }
  var lastDealRow = SLM_lastDealRow_(sheet);
  if (lastDealRow < 6) {
    return SLM_emptyPeek_(dateKey, true);
  }
  var lastMeta = SLM_lastRetailMeta_(sheet, lastDealRow);
  var span = SLM_daySpan_(sheet, dateKey, lastDealRow);
  var daily = SLM_sumDayRows_(sheet, span);
  var peek = {
    date: dateKey,
    month: String(dateKey || '').slice(0, 7),
    daily: daily,
    monthly: SLM_emptyTotals_(),
    rows: daily.dealCount,
    lastRetailDate: lastMeta.date || '',
    available: true,
    ms: Date.now() - started,
    cached: false
  };
  if (dateKey) {
    SLM_cachePut_(cacheKey, JSON.stringify(peek), 120);
  }
  peek.ms = Date.now() - started;
  return peek;
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
  var peek = SLM_peekDealInput_(key, { skipCache: true });
  ui.alert(
    'Read-only peek of DEALINPUT (no existing tabs were changed)\n\n' +
    'Date searched: ' + key + '\n' +
    'Retail deals that day: ' + peek.daily.dealCount + '\n' +
    'Retail new: ' + peek.daily.newSold + '\n' +
    'Retail used: ' + peek.daily.usedSold + '\n' +
    'Front: ' + peek.daily.frontGross + '\n' +
    'Back: ' + peek.daily.backGross + '\n' +
    'Total: ' + peek.daily.totalGross + '\n' +
    'Last retail day in DEALINPUT: ' + (peek.lastRetailDate || '(none)') + '\n' +
    'Scan time: ' + (Number(peek.ms || 0) / 1000).toFixed(2) + 's\n\n' +
    'If this is still zero on a day you can see in DEALINPUT, replace SLM_Config.gs, SLM_Import.gs, SLM_Api.gs, and SLM_App.html from the latest source.'
  );
}
