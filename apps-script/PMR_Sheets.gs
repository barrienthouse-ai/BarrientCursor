/**
 * Creates only missing PMR_* tabs. Never deletes, hides, or renames
 * any existing sheet — including leftover PMR sheets from a prior install.
 */
function PMR_ensureSheets() {
  var ss = PMR_ss_();
  PMR_ensureSheet_(ss, PMR_SHEETS.CONFIG, PMR_HEADERS.CONFIG, [
    ['Timezone', Session.getScriptTimeZone()],
    ['Submitter', 'Parts Manager'],
    ['Capital limit', PMR_DEFAULT_CAPITAL],
    ['RIM target', PMR_DEFAULT_RIM_TARGET],
    ['Report email', '']
  ]);
  PMR_ensureSheet_(ss, PMR_SHEETS.DAILY, PMR_HEADERS.DAILY, []);
  PMR_ensureSheet_(ss, PMR_SHEETS.LOST, PMR_HEADERS.LOST, []);
  PMR_ensureSheet_(ss, PMR_SHEETS.SOP, PMR_HEADERS.SOP, []);
  PMR_ensureSheet_(ss, PMR_SHEETS.BACKORDERS, PMR_HEADERS.BACKORDERS, []);
  PMR_ensureSheet_(ss, PMR_SHEETS.CORES, PMR_HEADERS.CORES, []);
  PMR_ensureDashboard_(ss);
  return PMR_reservedSheetNames();
}

function PMR_assertWritable_(name) {
  if (PMR_DO_NOT_TOUCH.indexOf(name) !== -1 || !PMR_isPmrSheetName_(name)) {
    throw new Error('PMR refused to write to "' + name + '". Only PMR_* tabs are writable.');
  }
}

function PMR_ensureSheet_(ss, name, headers, seedRows) {
  PMR_assertWritable_(name);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    if (seedRows && seedRows.length) {
      sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    }
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function PMR_ensureDashboard_(ss) {
  PMR_assertWritable_(PMR_SHEETS.DASHBOARD);
  var sheet = ss.getSheetByName(PMR_SHEETS.DASHBOARD);
  if (!sheet) {
    sheet = ss.insertSheet(PMR_SHEETS.DASHBOARD);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1').setValue('Parts Manager Report');
    sheet.getRange('A2').setValue('Use the Parts Manager Report menu to refresh this briefing. Other workbook tabs are not modified.');
  }
  return sheet;
}

var PMR_SS_CACHE_ = null;

function PMR_ss_() {
  if (!PMR_SS_CACHE_) {
    var id = PMR_workbookId_();
    PMR_SS_CACHE_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  }
  if (!PMR_SS_CACHE_) {
    throw new Error('PMR could not open the parts workbook. In the standalone web app, PMR_WEB_WORKBOOK_ID must be set.');
  }
  return PMR_SS_CACHE_;
}

function PMR_existingSheet_(name) {
  return PMR_ss_().getSheetByName(name);
}

function PMR_dateKeyFast_(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    var month = value.getMonth() + 1;
    var day = value.getDate();
    return value.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
  }
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  return '';
}

function PMR_readTail_(name, tailRows) {
  var sheet = PMR_existingSheet_(name);
  if (!sheet) {
    return { headers: [], values: [] };
  }
  var lastRow = sheet.getLastRow();
  var lastCol = Math.min(Math.max(sheet.getLastColumn(), 1), 30);
  if (lastRow < 1) {
    return { headers: [], values: [] };
  }
  tailRows = tailRows || 200;
  if (lastRow === 1) {
    return { headers: sheet.getRange(1, 1, 1, lastCol).getValues()[0], values: [] };
  }
  if (lastRow <= tailRows + 1) {
    var all = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    return { headers: all[0], values: all.slice(1) };
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var start = lastRow - tailRows + 1;
  return {
    headers: headers,
    values: sheet.getRange(start, 1, lastRow - start + 1, lastCol).getValues()
  };
}

function PMR_col_(headers, name) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === name) {
      return i;
    }
  }
  return -1;
}

var PMR_BRIEF_PROP_PREFIX_ = 'PMR_b_';
var PMR_BRIEF_INDEX_KEY_ = 'PMR_briefDates';

function PMR_todayKey_() {
  try {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (ignore) {
    return PMR_dateKeyFast_(new Date());
  }
}

function PMR_briefStoreGet_(dateKey) {
  if (!dateKey) {
    return null;
  }
  var cacheKey = PMR_BRIEF_PROP_PREFIX_ + dateKey;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      var fromCache = JSON.parse(cached);
      fromCache.cached = true;
      return fromCache;
    }
  } catch (ignoreCache) {}
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(cacheKey);
    if (raw) {
      var fromProps = JSON.parse(raw);
      fromProps.cached = true;
      try {
        CacheService.getScriptCache().put(cacheKey, raw, 600);
      } catch (ignorePut) {}
      return fromProps;
    }
  } catch (ignoreProps) {}
  return null;
}

function PMR_briefStorePut_(dateKey, payload) {
  if (!dateKey || !payload) {
    return;
  }
  var copy = JSON.parse(JSON.stringify(payload));
  delete copy.cached;
  var json = JSON.stringify(copy);
  var cacheKey = PMR_BRIEF_PROP_PREFIX_ + dateKey;
  try {
    CacheService.getScriptCache().put(cacheKey, json, 600);
  } catch (ignoreCache) {}
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty(cacheKey, json);
    var index = String(props.getProperty(PMR_BRIEF_INDEX_KEY_) || '');
    var dates = index ? index.split(',') : [];
    var next = [dateKey];
    for (var i = 0; i < dates.length; i++) {
      if (dates[i] && dates[i] !== dateKey) {
        next.push(dates[i]);
      }
    }
    var drop = next.slice(21);
    next = next.slice(0, 21);
    props.setProperty(PMR_BRIEF_INDEX_KEY_, next.join(','));
    for (var d = 0; d < drop.length; d++) {
      props.deleteProperty(PMR_BRIEF_PROP_PREFIX_ + drop[d]);
    }
  } catch (ignoreProps) {}
}

function PMR_clearBriefCache_(dateKey) {
  try {
    CacheService.getScriptCache().remove(PMR_BRIEF_PROP_PREFIX_ + dateKey);
  } catch (ignoreCache) {}
  try {
    PropertiesService.getScriptProperties().deleteProperty(PMR_BRIEF_PROP_PREFIX_ + dateKey);
  } catch (ignoreProps) {}
}

function PMR_headersFor_(name) {
  if (name === PMR_SHEETS.DAILY) return PMR_HEADERS.DAILY;
  if (name === PMR_SHEETS.LOST) return PMR_HEADERS.LOST;
  if (name === PMR_SHEETS.SOP) return PMR_HEADERS.SOP;
  if (name === PMR_SHEETS.BACKORDERS) return PMR_HEADERS.BACKORDERS;
  if (name === PMR_SHEETS.CORES) return PMR_HEADERS.CORES;
  if (name === PMR_SHEETS.CONFIG) return PMR_HEADERS.CONFIG;
  return [];
}

function PMR_sheet_(name) {
  var ss = PMR_ss_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = PMR_ensureSheet_(ss, name, PMR_headersFor_(name), []);
  }
  return sheet;
}

function PMR_replaceDateRows_(sheet, dateColumnName, dateKey, newRows, headers) {
  var values = sheet.getDataRange().getValues();
  var kept = [headers];
  if (values.length) {
    var header = values[0];
    var dateIdx = header.indexOf(dateColumnName);
    for (var i = 1; i < values.length; i++) {
      var existingDate = PMR_toDateKey_(values[i][dateIdx]);
      if (existingDate !== dateKey) {
        var padded = values[i].slice();
        while (padded.length < headers.length) {
          padded.push('');
        }
        kept.push(padded.slice(0, headers.length));
      }
    }
  }
  newRows.forEach(function (row) {
    kept.push(row);
  });
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, headers.length).setValues(kept);
  sheet.setFrozenRows(1);
}
