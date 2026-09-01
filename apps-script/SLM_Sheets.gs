/**
 * Creates only missing SLM_* tabs. Never deletes, hides, or renames
 * any existing sheet — including DEALINPUT, SUMMARY, SMR_* tabs, and leftover SLM sheets.
 */
function SLM_ensureSheets() {
  var ss = SpreadsheetApp.getActive();
  SLM_ensureSheet_(ss, SLM_SHEETS.CONFIG, SLM_HEADERS.CONFIG, [
    ['Timezone', Session.getScriptTimeZone()],
    ['Submitter', 'Sales Manager']
  ]);
  SLM_ensureSheet_(ss, SLM_SHEETS.DAILY, SLM_HEADERS.DAILY, []);
  SLM_ensureDashboard_(ss);
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

function SLM_upsertDaily_(report) {
  var sheet = SLM_sheet_(SLM_SHEETS.DAILY);
  var table = SLM_readDailyTable_();
  var dateIdx = SLM_col_(table.headers, 'Date');
  var rowNumber = -1;
  for (var i = 0; i < table.values.length; i++) {
    if (SLM_dateKeyFast_(table.values[i][dateIdx]) === report.date) {
      rowNumber = i + 2;
      break;
    }
  }
  var values = SLM_valuesFromReport_(report);
  if (rowNumber > 0) {
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
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
