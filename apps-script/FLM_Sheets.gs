/**
 * Creates only missing FLM_* tabs. Never deletes, hides, or renames
 * any existing sheet — including DEALINPUT, FLEET CUSTOMERS, SMR_*, and SLM_*.
 */
function FLM_ensureSheets() {
  var ss = FLM_ss_();
  FLM_ensureSheet_(ss, FLM_SHEETS.CONFIG, FLM_HEADERS.CONFIG, [
    ['Timezone', Session.getScriptTimeZone()],
    ['Submitter', 'Fleet Manager']
  ]);
  FLM_ensureSheet_(ss, FLM_SHEETS.DAILY, FLM_HEADERS.DAILY, []);
  FLM_ensureSheet_(ss, FLM_SHEETS.WORKING, FLM_HEADERS.WORKING, []);
  FLM_ensureSheet_(ss, FLM_SHEETS.GOALS, FLM_HEADERS.GOALS, []);
  FLM_ensureDashboard_(ss);
  return FLM_reservedSheetNames();
}

function FLM_assertWritable_(name) {
  if (FLM_DO_NOT_TOUCH.indexOf(name) !== -1 || !FLM_isFlmSheetName_(name)) {
    throw new Error('FLM refused to write to "' + name + '". Only FLM_* tabs are writable.');
  }
}

function FLM_ensureSheet_(ss, name, headers, seedRows) {
  FLM_assertWritable_(name);
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

function FLM_ensureDashboard_(ss) {
  FLM_assertWritable_(FLM_SHEETS.DASHBOARD);
  var sheet = ss.getSheetByName(FLM_SHEETS.DASHBOARD);
  if (!sheet) {
    sheet = ss.insertSheet(FLM_SHEETS.DASHBOARD);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1').setValue('Fleet Manager Report');
    sheet.getRange('A2').setValue('Use the Fleet Manager Report menu or the standalone web app. Other workbook tabs are not modified.');
  }
  return sheet;
}

var FLM_SS_CACHE_ = null;

function FLM_ss_() {
  if (!FLM_SS_CACHE_) {
    var id = FLM_workbookId_();
    FLM_SS_CACHE_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  }
  if (!FLM_SS_CACHE_) {
    throw new Error('FLM could not open the fleet workbook. In the standalone web app, FLM_WEB_WORKBOOK_ID must be set.');
  }
  return FLM_SS_CACHE_;
}

function FLM_sheet_(name) {
  FLM_assertWritable_(name);
  var sheet = FLM_ss_().getSheetByName(name);
  if (!sheet) {
    FLM_ensureSheets();
    sheet = FLM_ss_().getSheetByName(name);
  }
  return sheet;
}

function FLM_existingSheet_(name) {
  return FLM_ss_().getSheetByName(name);
}

function FLM_col_(headers, name) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === name) {
      return i;
    }
  }
  return -1;
}

function FLM_readTable_(sheetName, fallbackHeaders) {
  var sheet = FLM_existingSheet_(sheetName);
  if (!sheet || sheet.getLastRow() < 1) {
    return { headers: fallbackHeaders.slice(), values: [] };
  }
  var lastRow = sheet.getLastRow();
  var lastCol = Math.min(Math.max(sheet.getLastColumn(), 1), fallbackHeaders.length);
  var all = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  return { headers: all[0], values: all.slice(1) };
}

function FLM_readDailyTable_() {
  return FLM_readTable_(FLM_SHEETS.DAILY, FLM_HEADERS.DAILY);
}

function FLM_readWorkingTable_() {
  return FLM_readTable_(FLM_SHEETS.WORKING, FLM_HEADERS.WORKING);
}

function FLM_readGoalsTable_() {
  return FLM_readTable_(FLM_SHEETS.GOALS, FLM_HEADERS.GOALS);
}

function FLM_rowFromDaily_(headers, values) {
  return {
    date: FLM_dateKeyFast_(values[FLM_col_(headers, 'Date')]),
    soldDeals: FLM_toNumber_(values[FLM_col_(headers, 'Sold deals')]),
    workingDeals: FLM_toNumber_(values[FLM_col_(headers, 'Working deals')]),
    frontGross: FLM_roundMoney_(values[FLM_col_(headers, 'Front gross')]),
    financeGross: FLM_roundMoney_(values[FLM_col_(headers, 'Finance gross')]),
    totalGross: FLM_roundMoney_(values[FLM_col_(headers, 'Total gross')]),
    deliveries: FLM_toNumber_(values[FLM_col_(headers, 'Deliveries')]),
    courtesyDeliveries: FLM_toNumber_(values[FLM_col_(headers, 'Courtesy deliveries')]),
    expectedDeliveries: FLM_toNumber_(values[FLM_col_(headers, 'Expected deliveries')]),
    notes: String(values[FLM_col_(headers, 'Notes')] || ''),
    submittedBy: String(values[FLM_col_(headers, 'Submitted by')] || ''),
    submittedAt: String(values[FLM_col_(headers, 'Submitted at')] || ''),
    source: String(values[FLM_col_(headers, 'Source')] || 'manual')
  };
}

function FLM_valuesFromReport_(report) {
  return [
    report.date,
    report.soldDeals,
    report.workingDeals,
    report.frontGross,
    report.financeGross,
    report.totalGross,
    report.deliveries,
    report.courtesyDeliveries,
    report.expectedDeliveries,
    report.notes,
    report.submittedBy,
    report.submittedAt,
    report.source
  ];
}

function FLM_upsertDaily_(report) {
  var sheet = FLM_sheet_(FLM_SHEETS.DAILY);
  var table = FLM_readDailyTable_();
  var dateIdx = FLM_col_(table.headers, 'Date');
  var rowNumber = -1;
  for (var i = 0; i < table.values.length; i++) {
    if (FLM_dateKeyFast_(table.values[i][dateIdx]) === report.date) {
      rowNumber = i + 2;
      break;
    }
  }
  var values = FLM_valuesFromReport_(report);
  if (rowNumber > 0) {
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function FLM_rowFromWorking_(headers, values) {
  return {
    id: String(values[FLM_col_(headers, 'Deal ID')] || ''),
    openedDate: FLM_dateKeyFast_(values[FLM_col_(headers, 'Opened date')]),
    customer: String(values[FLM_col_(headers, 'Customer')] || ''),
    account: String(values[FLM_col_(headers, 'Account')] || ''),
    stock: String(values[FLM_col_(headers, 'Stock')] || ''),
    vehicle: String(values[FLM_col_(headers, 'Vehicle')] || ''),
    units: Math.max(1, Math.round(FLM_toNumber_(values[FLM_col_(headers, 'Units')]) || 1)),
    frontGross: FLM_roundMoney_(values[FLM_col_(headers, 'Front gross')]),
    financeGross: FLM_roundMoney_(values[FLM_col_(headers, 'Finance gross')]),
    totalGross: FLM_roundMoney_(values[FLM_col_(headers, 'Total gross')]),
    expectedDelivery: FLM_dateKeyFast_(values[FLM_col_(headers, 'Expected delivery')]),
    status: String(values[FLM_col_(headers, 'Status')] || 'working').toLowerCase(),
    notes: String(values[FLM_col_(headers, 'Notes')] || ''),
    submittedBy: String(values[FLM_col_(headers, 'Submitted by')] || ''),
    updatedAt: String(values[FLM_col_(headers, 'Updated at')] || '')
  };
}

function FLM_valuesFromWorking_(deal) {
  return [
    deal.id,
    deal.openedDate,
    deal.customer,
    deal.account,
    deal.stock,
    deal.vehicle,
    deal.units,
    deal.frontGross,
    deal.financeGross,
    deal.totalGross,
    deal.expectedDelivery,
    deal.status,
    deal.notes,
    deal.submittedBy,
    deal.updatedAt
  ];
}

function FLM_appendWorking_(deal) {
  FLM_sheet_(FLM_SHEETS.WORKING).appendRow(FLM_valuesFromWorking_(deal));
}

function FLM_upsertWorking_(deal) {
  var sheet = FLM_sheet_(FLM_SHEETS.WORKING);
  var table = FLM_readWorkingTable_();
  var idIdx = FLM_col_(table.headers, 'Deal ID');
  var rowNumber = -1;
  for (var i = 0; i < table.values.length; i++) {
    if (String(table.values[i][idIdx]) === deal.id) {
      rowNumber = i + 2;
      break;
    }
  }
  var values = FLM_valuesFromWorking_(deal);
  if (rowNumber > 0) {
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function FLM_rowFromGoal_(headers, values) {
  return {
    month: String(values[FLM_col_(headers, 'Month')] || '').slice(0, 7),
    unitGoal: FLM_toNumber_(values[FLM_col_(headers, 'Unit goal')]),
    grossGoal: FLM_roundMoney_(values[FLM_col_(headers, 'Gross goal')]),
    notes: String(values[FLM_col_(headers, 'Notes')] || ''),
    submittedBy: String(values[FLM_col_(headers, 'Submitted by')] || ''),
    submittedAt: String(values[FLM_col_(headers, 'Submitted at')] || '')
  };
}

function FLM_upsertGoal_(goal) {
  var sheet = FLM_sheet_(FLM_SHEETS.GOALS);
  var table = FLM_readGoalsTable_();
  var monthIdx = FLM_col_(table.headers, 'Month');
  var rowNumber = -1;
  for (var i = 0; i < table.values.length; i++) {
    if (String(table.values[i][monthIdx] || '').slice(0, 7) === goal.month) {
      rowNumber = i + 2;
      break;
    }
  }
  var values = [goal.month, goal.unitGoal, goal.grossGoal, goal.notes, goal.submittedBy, goal.submittedAt];
  if (rowNumber > 0) {
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

var FLM_BRIEF_PROP_PREFIX_ = 'FLM_b_';
var FLM_BRIEF_INDEX_KEY_ = 'FLM_briefDates';

function FLM_briefStoreGet_(dateKey) {
  if (!dateKey) {
    return null;
  }
  var cacheKey = FLM_BRIEF_PROP_PREFIX_ + dateKey;
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

function FLM_briefStorePut_(dateKey, payload) {
  if (!dateKey || !payload) {
    return;
  }
  var copy = JSON.parse(JSON.stringify(payload));
  delete copy.cached;
  var json = JSON.stringify(copy);
  var cacheKey = FLM_BRIEF_PROP_PREFIX_ + dateKey;
  try {
    CacheService.getScriptCache().put(cacheKey, json, 600);
  } catch (ignoreCache) {}
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty(cacheKey, json);
    var index = String(props.getProperty(FLM_BRIEF_INDEX_KEY_) || '');
    var dates = index ? index.split(',') : [];
    var next = [dateKey];
    for (var i = 0; i < dates.length; i++) {
      if (dates[i] && dates[i] !== dateKey) {
        next.push(dates[i]);
      }
    }
    var drop = next.slice(21);
    next = next.slice(0, 21);
    props.setProperty(FLM_BRIEF_INDEX_KEY_, next.join(','));
    for (var d = 0; d < drop.length; d++) {
      props.deleteProperty(FLM_BRIEF_PROP_PREFIX_ + drop[d]);
    }
  } catch (ignoreProps) {}
}
