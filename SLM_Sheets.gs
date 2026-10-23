/**
 * Creates only missing SLM_* tabs. Never deletes, hides, or renames
 * any existing sheet — including DEALINPUT, SUMMARY, SMR_* tabs, and leftover SLM sheets.
 */
function SLM_ensureSheets() {
  var ss = SpreadsheetApp.getActive();
  SLM_ensureSheet_(ss, SLM_SHEETS.CONFIG, SLM_HEADERS.CONFIG, [
    ['Timezone', Session.getScriptTimeZone()],
    ['Submitter', 'Sales Manager'],
    ['Report email', '']
  ]);
  SLM_ensureSheet_(ss, SLM_SHEETS.DAILY, SLM_HEADERS.DAILY, []);
  SLM_ensureDashboard_(ss);
  SLM_ensureConfigKeys_();
  return SLM_reservedSheetNames();
}

function SLM_assertWritable_(name) {
  if (SLM_DO_NOT_TOUCH.indexOf(name) !== -1 || !SLM_isSlmSheetName_(name)) {
    throw new Error('SLM refused to write to "' + name + '". Only SLM_* tabs are writable.');
  }
}

function SLM_ensureSheet_(ss, name, headers, seedRows) {
  SLM_assertWritable_(name);
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

function SLM_ensureDashboard_(ss) {
  SLM_assertWritable_(SLM_SHEETS.DASHBOARD);
  var sheet = ss.getSheetByName(SLM_SHEETS.DASHBOARD);
  if (!sheet) {
    sheet = ss.insertSheet(SLM_SHEETS.DASHBOARD);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1').setValue('Sales Manager Report');
    sheet.getRange('A2').setValue('Use the Sales Manager Report menu to open the end-of-day recap. Other workbook tabs are not modified.');
  }
  return sheet;
}

var SLM_SS_CACHE_ = null;

function SLM_ss_() {
  if (!SLM_SS_CACHE_) {
    SLM_SS_CACHE_ = SpreadsheetApp.getActive();
  }
  return SLM_SS_CACHE_;
}

function SLM_sheet_(name) {
  SLM_assertWritable_(name);
  var sheet = SLM_ss_().getSheetByName(name);
  if (!sheet) {
    SLM_ensureSheets();
    sheet = SLM_ss_().getSheetByName(name);
  }
  return sheet;
}

function SLM_existingSheet_(name) {
  return SLM_ss_().getSheetByName(name);
}

function SLM_col_(headers, name) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === name) {
      return i;
    }
  }
  return -1;
}

function SLM_readDailyTable_() {
  var sheet = SLM_existingSheet_(SLM_SHEETS.DAILY);
  if (!sheet || sheet.getLastRow() < 1) {
    return { headers: SLM_HEADERS.DAILY.slice(), values: [] };
  }
  var lastRow = sheet.getLastRow();
  var lastCol = Math.min(Math.max(sheet.getLastColumn(), 1), SLM_HEADERS.DAILY.length);
  var all = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  return { headers: all[0], values: all.slice(1) };
}

function SLM_rowFromValues_(headers, values) {
  var dateIdx = SLM_col_(headers, 'Date');
  return {
    date: SLM_dateKeyFast_(values[dateIdx]),
    newSold: SLM_toNumber_(values[SLM_col_(headers, 'New sold')]),
    usedSold: SLM_toNumber_(values[SLM_col_(headers, 'Used sold')]),
    totalSold: SLM_toNumber_(values[SLM_col_(headers, 'Total sold')]),
    frontGross: SLM_roundMoney_(values[SLM_col_(headers, 'Front gross')]),
    backGross: SLM_roundMoney_(values[SLM_col_(headers, 'Back gross')]),
    totalGross: SLM_roundMoney_(values[SLM_col_(headers, 'Total gross')]),
    appointments: SLM_toNumber_(values[SLM_col_(headers, 'Appointments')]),
    shownAppointments: SLM_toNumber_(values[SLM_col_(headers, 'Shown appointments')]),
    showroomVisits: SLM_toNumber_(values[SLM_col_(headers, 'Showroom visits')]),
    nextDayAppointments: SLM_toNumber_(values[SLM_col_(headers, 'Next day appointments')]),
    nextBusinessDate: SLM_dateKeyFast_(values[SLM_col_(headers, 'Next business date')]),
    notes: String(values[SLM_col_(headers, 'Notes')] || ''),
    submittedBy: String(values[SLM_col_(headers, 'Submitted by')] || ''),
    submittedAt: String(values[SLM_col_(headers, 'Submitted at')] || ''),
    source: String(values[SLM_col_(headers, 'Source')] || 'manual')
  };
}

function SLM_valuesFromReport_(report) {
  return [
    report.date,
    report.newSold,
    report.usedSold,
    report.totalSold,
    report.frontGross,
    report.backGross,
    report.totalGross,
    report.appointments,
    report.shownAppointments,
    report.showroomVisits,
    report.nextDayAppointments,
    report.nextBusinessDate,
    report.notes,
    report.submittedBy,
    report.submittedAt,
    report.source
  ];
}

function SLM_matchDailyIndexes_(table, dateKey) {
  var dateIdx = SLM_col_(table.headers, 'Date');
  var matches = [];
  for (var i = 0; i < (table.values || []).length; i++) {
    if (SLM_sameDateKey_(table.values[i][dateIdx], dateKey)) {
      matches.push(i);
    }
  }
  return matches;
}

/**
 * Pure upsert used by tests and the sheet writer.
 * Writes the first matching date, drops later same-date rows, or appends.
 */
function SLM_applyDailyUpsertToTable_(table, report) {
  if (!report || !SLM_dateKeyFast_(report.date)) {
    throw new Error('Choose a report date before saving.');
  }
  var values = (table.values || []).slice();
  var matches = SLM_matchDailyIndexes_({ headers: table.headers, values: values }, report.date);
  var row = SLM_valuesFromReport_(report);
  var overwritten = matches.length > 0;
  if (overwritten) {
    values[matches[0]] = row;
    for (var i = matches.length - 1; i >= 1; i--) {
      values.splice(matches[i], 1);
    }
  } else {
    values.push(row);
  }
  return {
    headers: table.headers,
    values: values,
    overwritten: overwritten,
    removedDuplicates: Math.max(0, matches.length - 1),
    date: report.date
  };
}

function SLM_dedupeDailyValues_(headers, values) {
  var dateIdx = SLM_col_(headers, 'Date');
  var seen = {};
  var out = [];
  var removed = 0;
  for (var i = 0; i < (values || []).length; i++) {
    var key = SLM_dateKeyFast_(values[i][dateIdx]);
    if (key && seen[key]) {
      removed += 1;
      continue;
    }
    if (key) {
      seen[key] = true;
    }
    out.push(values[i]);
  }
  return { headers: headers, values: out, removedDuplicates: removed };
}

function SLM_upsertDaily_(report) {
  if (!report || !SLM_dateKeyFast_(report.date)) {
    throw new Error('Choose a report date before saving.');
  }
  var sheet = SLM_sheet_(SLM_SHEETS.DAILY);
  var table = SLM_readDailyTable_();
  var planned = SLM_applyDailyUpsertToTable_(table, report);
  var values = SLM_valuesFromReport_(report);
  if (planned.overwritten) {
    var matches = SLM_matchDailyIndexes_(table, report.date);
    sheet.getRange(matches[0] + 2, 1, 1, values.length).setValues([values]);
    for (var d = matches.length - 1; d >= 1; d--) {
      sheet.deleteRow(matches[d] + 2);
    }
  } else {
    sheet.appendRow(values);
  }
  return {
    overwritten: planned.overwritten,
    removedDuplicates: planned.removedDuplicates,
    date: report.date
  };
}

function SLM_dedupeDailySheet_() {
  var sheet = SLM_existingSheet_(SLM_SHEETS.DAILY);
  if (!sheet || sheet.getLastRow() < 2) {
    return { removedDuplicates: 0 };
  }
  var table = SLM_readDailyTable_();
  var dateIdx = SLM_col_(table.headers, 'Date');
  var seen = {};
  var deleteRows = [];
  for (var i = 0; i < table.values.length; i++) {
    var key = SLM_dateKeyFast_(table.values[i][dateIdx]);
    if (!key) {
      continue;
    }
    if (seen[key]) {
      deleteRows.push(i + 2);
    } else {
      seen[key] = true;
    }
  }
  for (var d = deleteRows.length - 1; d >= 0; d--) {
    sheet.deleteRow(deleteRows[d]);
  }
  return { removedDuplicates: deleteRows.length };
}

function SLM_ensureConfigKeys_() {
  var sheet = SLM_sheet_(SLM_SHEETS.CONFIG);
  var wanted = {
    Timezone: Session.getScriptTimeZone(),
    Submitter: 'Sales Manager',
    'Report email': ''
  };
  var last = sheet.getLastRow();
  var existing = {};
  if (last >= 2) {
    var values = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) {
      existing[String(values[i][0])] = i + 2;
    }
  }
  Object.keys(wanted).forEach(function (key) {
    if (!existing[key]) {
      sheet.appendRow([key, wanted[key]]);
    }
  });
}

function SLM_configGet_(key) {
  var sheet = SLM_existingSheet_(SLM_SHEETS.CONFIG);
  if (!sheet || sheet.getLastRow() < 2) {
    return '';
  }
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      return String(values[i][1] || '').trim();
    }
  }
  return '';
}

function SLM_configSet_(key, value) {
  SLM_ensureSheets();
  var sheet = SLM_sheet_(SLM_SHEETS.CONFIG);
  var last = Math.max(sheet.getLastRow(), 1);
  if (last >= 2) {
    var values = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]) === key) {
        sheet.getRange(i + 2, 2).setValue(value);
        return;
      }
    }
  }
  sheet.appendRow([key, value]);
}

function SLM_isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function SLM_getReportEmail_() {
  return SLM_configGet_('Report email');
}

function SLM_setReportEmail_(email) {
  var text = String(email || '').trim();
  if (text && !SLM_isValidEmail_(text)) {
    throw new Error('Enter a valid report email address.');
  }
  SLM_configSet_('Report email', text);
  return text;
}

var SLM_BRIEF_PROP_PREFIX_ = 'SLM_b_';
var SLM_BRIEF_INDEX_KEY_ = 'SLM_briefDates';

function SLM_briefStoreGet_(dateKey) {
  if (!dateKey) {
    return null;
  }
  var cacheKey = SLM_BRIEF_PROP_PREFIX_ + dateKey;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (ignoreCache) {}
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(cacheKey);
    if (raw) {
      try {
        CacheService.getScriptCache().put(cacheKey, raw, 600);
      } catch (ignorePut) {}
      return JSON.parse(raw);
    }
  } catch (ignoreProps) {}
  return null;
}

function SLM_briefStorePut_(dateKey, payload) {
  if (!dateKey || !payload) {
    return;
  }
  var json = JSON.stringify(payload);
  var cacheKey = SLM_BRIEF_PROP_PREFIX_ + dateKey;
  try {
    CacheService.getScriptCache().put(cacheKey, json, 600);
  } catch (ignoreCache) {}
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty(cacheKey, json);
    var index = String(props.getProperty(SLM_BRIEF_INDEX_KEY_) || '');
    var dates = index ? index.split(',') : [];
    var next = [dateKey];
    for (var i = 0; i < dates.length; i++) {
      if (dates[i] && dates[i] !== dateKey) {
        next.push(dates[i]);
      }
    }
    var drop = next.slice(21);
    next = next.slice(0, 21);
    props.setProperty(SLM_BRIEF_INDEX_KEY_, next.join(','));
    for (var d = 0; d < drop.length; d++) {
      props.deleteProperty(SLM_BRIEF_PROP_PREFIX_ + drop[d]);
    }
  } catch (ignoreProps) {}
}
