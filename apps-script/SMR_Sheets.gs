/**
 * Creates only missing SMR_* tabs. Never deletes, hides, or renames
 * any existing sheet — including leftover SMR sheets from a prior install.
 */
function SMR_ensureSheets() {
  var ss = SMR_ss_();
  SMR_ensureSheet_(ss, SMR_SHEETS.CONFIG, SMR_HEADERS.CONFIG, [['Timezone', Session.getScriptTimeZone()], ['Submitter', 'Service Manager']]);
  SMR_ensureSheet_(ss, SMR_SHEETS.ROSTER, SMR_HEADERS.ROSTER, SMR_DEFAULT_ROSTER.map(function (name) {
    return [name, 'Yes'];
  }));
  SMR_ensureSheet_(ss, SMR_SHEETS.TECH_HOURS, SMR_HEADERS.TECH_HOURS, []);
  SMR_upgradeTechHoursHeader_(ss.getSheetByName(SMR_SHEETS.TECH_HOURS));
  SMR_ensureSheet_(ss, SMR_SHEETS.GROSS, SMR_HEADERS.GROSS, []);
  SMR_ensureSheet_(ss, SMR_SHEETS.HEAT, SMR_HEADERS.HEAT, []);
  SMR_upgradeHeatHeader_(ss.getSheetByName(SMR_SHEETS.HEAT));
  SMR_ensureSheet_(ss, SMR_SHEETS.ROS, SMR_HEADERS.ROS, []);
  SMR_ensureDashboard_(ss);
  return SMR_reservedSheetNames();
}

function SMR_assertWritable_(name) {
  if (SMR_DO_NOT_TOUCH.indexOf(name) !== -1 || !SMR_isSmrSheetName_(name)) {
    throw new Error('SMR refused to write to "' + name + '". Only SMR_* tabs are writable.');
  }
}

function SMR_ensureSheet_(ss, name, headers, seedRows) {
  SMR_assertWritable_(name);
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

function SMR_ensureDashboard_(ss) {
  SMR_assertWritable_(SMR_SHEETS.DASHBOARD);
  var sheet = ss.getSheetByName(SMR_SHEETS.DASHBOARD);
  if (!sheet) {
    sheet = ss.insertSheet(SMR_SHEETS.DASHBOARD);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1').setValue('Service Manager Report');
    sheet.getRange('A2').setValue('Use the Service Manager Report menu to refresh this briefing. Other workbook tabs are not modified.');
  }
  return sheet;
}

var SMR_SS_CACHE_ = null;

function SMR_ss_() {
  if (!SMR_SS_CACHE_) {
    var id = SMR_workbookId_();
    SMR_SS_CACHE_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  }
  if (!SMR_SS_CACHE_) {
    throw new Error('SMR could not open the service workbook. In the standalone web app, SMR_WEB_WORKBOOK_ID must be set.');
  }
  return SMR_SS_CACHE_;
}

function SMR_existingSheet_(name) {
  return SMR_ss_().getSheetByName(name);
}

function SMR_dateKeyFast_(value) {
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

function SMR_readTail_(name, tailRows) {
  var sheet = SMR_existingSheet_(name);
  if (!sheet) {
    return { headers: [], values: [] };
  }
  var lastRow = sheet.getLastRow();
  var lastCol = Math.min(Math.max(sheet.getLastColumn(), 1), 18);
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

function SMR_col_(headers, name) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === name) {
      return i;
    }
  }
  return -1;
}

var SMR_BRIEF_PROP_PREFIX_ = 'SMR_b_';
var SMR_BRIEF_INDEX_KEY_ = 'SMR_briefDates';
var SMR_ROSTER_PROP_KEY_ = 'SMR_roster';

function SMR_todayKey_() {
  try {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (ignore) {
    return SMR_dateKeyFast_(new Date());
  }
}

function SMR_safeJson_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function SMR_briefStoreGet_(dateKey) {
  if (!dateKey) {
    return null;
  }
  var cacheKey = SMR_BRIEF_PROP_PREFIX_ + dateKey;
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

function SMR_briefStorePut_(dateKey, payload) {
  if (!dateKey || !payload) {
    return;
  }
  var copy = JSON.parse(JSON.stringify(payload));
  delete copy.cached;
  var json = JSON.stringify(copy);
  var cacheKey = SMR_BRIEF_PROP_PREFIX_ + dateKey;
  try {
    CacheService.getScriptCache().put(cacheKey, json, 600);
  } catch (ignoreCache) {}
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty(cacheKey, json);
    var index = String(props.getProperty(SMR_BRIEF_INDEX_KEY_) || '');
    var dates = index ? index.split(',') : [];
    var next = [dateKey];
    for (var i = 0; i < dates.length; i++) {
      if (dates[i] && dates[i] !== dateKey) {
        next.push(dates[i]);
      }
    }
    var drop = next.slice(21);
    next = next.slice(0, 21);
    props.setProperty(SMR_BRIEF_INDEX_KEY_, next.join(','));
    for (var d = 0; d < drop.length; d++) {
      props.deleteProperty(SMR_BRIEF_PROP_PREFIX_ + drop[d]);
    }
  } catch (ignoreProps) {}
}

function SMR_rosterStoreGet_() {
  try {
    var cached = CacheService.getScriptCache().get(SMR_ROSTER_PROP_KEY_);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (ignoreCache) {}
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(SMR_ROSTER_PROP_KEY_);
    if (raw) {
      try {
        CacheService.getScriptCache().put(SMR_ROSTER_PROP_KEY_, raw, 1800);
      } catch (ignorePut) {}
      return JSON.parse(raw);
    }
  } catch (ignoreProps) {}
  return null;
}

function SMR_rosterStorePut_(roster) {
  if (!roster || !roster.length) {
    return;
  }
  var json = JSON.stringify(roster);
  try {
    CacheService.getScriptCache().put(SMR_ROSTER_PROP_KEY_, json, 1800);
  } catch (ignoreCache) {}
  try {
    PropertiesService.getScriptProperties().setProperty(SMR_ROSTER_PROP_KEY_, json);
  } catch (ignoreProps) {}
}

function SMR_clearBriefCache_(dateKey) {
  try {
    CacheService.getScriptCache().remove(SMR_BRIEF_PROP_PREFIX_ + dateKey);
  } catch (ignoreCache) {}
  try {
    PropertiesService.getScriptProperties().deleteProperty(SMR_BRIEF_PROP_PREFIX_ + dateKey);
  } catch (ignoreProps) {}
}

function SMR_headersFor_(name) {
  if (name === SMR_SHEETS.TECH_HOURS) return SMR_HEADERS.TECH_HOURS;
  if (name === SMR_SHEETS.GROSS) return SMR_HEADERS.GROSS;
  if (name === SMR_SHEETS.HEAT) return SMR_HEADERS.HEAT;
  if (name === SMR_SHEETS.ROS) return SMR_HEADERS.ROS;
  if (name === SMR_SHEETS.ROSTER) return SMR_HEADERS.ROSTER;
  if (name === SMR_SHEETS.CONFIG) return SMR_HEADERS.CONFIG;
  return [];
}

function SMR_sheet_(name) {
  var ss = SMR_ss_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    var seed = name === SMR_SHEETS.ROSTER
      ? SMR_DEFAULT_ROSTER.map(function (techName) { return [techName, 'Yes']; })
      : [];
    sheet = SMR_ensureSheet_(ss, name, SMR_headersFor_(name), seed);
  }
  return sheet;
}

function SMR_readObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      row[headers[c]] = values[i][c];
      if (values[i][c] !== '' && values[i][c] !== null) {
        empty = false;
      }
    }
    if (!empty) {
      rows.push(row);
    }
  }
  return rows;
}

function SMR_upgradeTechHoursHeader_(sheet) {
  if (!sheet) {
    return;
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  if (headers.indexOf('Open ROs') !== -1) {
    return;
  }
  if (headers[0] === 'Date' && headers[4] === 'Notes') {
    sheet.insertColumnsAfter(4, 3);
    sheet.getRange(1, 5, 1, 3).setValues([['Open ROs', 'Closed today', 'Written today']]);
    return;
  }
  sheet.getRange(1, 1, 1, SMR_HEADERS.TECH_HOURS.length).setValues([SMR_HEADERS.TECH_HOURS]);
}

function SMR_upgradeHeatHeader_(sheet) {
  if (!sheet) {
    return;
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var haveAdvisor = headers.indexOf('Advisor') !== -1;
  var haveTech = headers.indexOf('Technician') !== -1;
  if (haveAdvisor && haveTech) {
    return;
  }
  var extras = [];
  if (!haveAdvisor) {
    extras.push('Advisor');
  }
  if (!haveTech) {
    extras.push('Technician');
  }
  sheet.getRange(1, lastCol + 1, 1, extras.length).setValues([extras]);
}

function SMR_replaceDateRows_(sheet, dateColumnName, dateKey, newRows, headers) {
  var values = sheet.getDataRange().getValues();
  var kept = [headers];
  if (values.length) {
    var header = values[0];
    var dateIdx = header.indexOf(dateColumnName);
    for (var i = 1; i < values.length; i++) {
      var existingDate = SMR_toDateKey_(values[i][dateIdx]);
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
