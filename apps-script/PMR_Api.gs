/**
 * Data API used by the briefing dialog and dashboard refresh.
 * These functions are safe to call from google.script.run.
 */
function PMR_getConfig() {
  var cfg = PMR_readConfigMap_();
  return {
    timezone: Session.getScriptTimeZone(),
    submitter: cfg.Submitter || 'Parts Manager',
    capitalLimit: PMR_toNumber_(cfg['Capital limit']) || PMR_DEFAULT_CAPITAL,
    rimTargetPercent: PMR_toNumber_(cfg['RIM target']) || PMR_DEFAULT_RIM_TARGET,
    reportEmail: cfg['Report email'] || ''
  };
}

function PMR_readConfigMap_() {
  var table = PMR_readTail_(PMR_SHEETS.CONFIG, 40);
  var map = {};
  for (var i = 0; i < table.values.length; i++) {
    var key = String(table.values[i][0] || '').trim();
    if (key) {
      map[key] = table.values[i][1];
    }
  }
  return map;
}

function PMR_setConfigValue_(key, value) {
  var sheet = PMR_sheet_(PMR_SHEETS.CONFIG);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return value;
    }
  }
  sheet.appendRow([key, value]);
  return value;
}

function PMR_emptyReport_() {
  return {
    inventoryValue: 0, capitalLimit: PMR_DEFAULT_CAPITAL, payablesOpen: 0,
    n3mValue: 0, n6mValue: 0, overstockValue: 0,
    retailSales: 0, wholesaleSales: 0, internalSales: 0,
    counterWaitMinutes: 0, lostSalesCount: 0, lostSalesDollars: 0,
    sopReceivedCount: 0, sopAgedCount: 0, sopAgedValue: 0,
    rimCompliancePercent: 0, rimTargetPercent: PMR_DEFAULT_RIM_TARGET,
    emergencyOrderCount: 0, emergencyFreightCost: 0, outstandingCoresValue: 0,
    wholesaleStops: 0, hotshotRuns: 0, deliveryFuelCost: 0, notes: ''
  };
}

function PMR_rowToReport_(headers, values) {
  var obj = {};
  headers.forEach(function (header, idx) {
    obj[header] = values[idx];
  });
  return {
    date: PMR_dateKeyFast_(obj.Date) || PMR_toDateKey_(obj.Date),
    inventoryValue: PMR_toNumber_(obj['Inventory $']),
    capitalLimit: PMR_toNumber_(obj['Capital limit $']) || PMR_DEFAULT_CAPITAL,
    payablesOpen: PMR_toNumber_(obj['Payables $']),
    n3mValue: PMR_toNumber_(obj['N3M $']),
    n6mValue: PMR_toNumber_(obj['N6M $']),
    overstockValue: PMR_toNumber_(obj['Overstock $']),
    retailSales: PMR_toNumber_(obj['Retail sales $']),
    wholesaleSales: PMR_toNumber_(obj['Wholesale sales $']),
    internalSales: PMR_toNumber_(obj['Internal sales $']),
    counterWaitMinutes: PMR_toNumber_(obj['Counter wait min']),
    lostSalesCount: PMR_toNumber_(obj['Lost sales count']),
    lostSalesDollars: PMR_toNumber_(obj['Lost sales $']),
    sopReceivedCount: PMR_toNumber_(obj['SOP received']),
    sopAgedCount: PMR_toNumber_(obj['SOP aged 14+']),
    sopAgedValue: PMR_toNumber_(obj['SOP aged $']),
    rimCompliancePercent: PMR_toNumber_(obj['RIM %']),
    rimTargetPercent: PMR_toNumber_(obj['RIM target %']) || PMR_DEFAULT_RIM_TARGET,
    emergencyOrderCount: PMR_toNumber_(obj['Emergency / CSO']),
    emergencyFreightCost: PMR_toNumber_(obj['Freight $']),
    outstandingCoresValue: PMR_toNumber_(obj['Cores $']),
    wholesaleStops: PMR_toNumber_(obj['Wholesale stops']),
    hotshotRuns: PMR_toNumber_(obj['Hot-shots']),
    deliveryFuelCost: PMR_toNumber_(obj['Fuel $']),
    notes: obj.Notes || '',
    submittedBy: obj['Submitted by'] || 'Parts Manager',
    submittedAt: obj['Submitted at'] || ''
  };
}

function PMR_recallDaily_(dateKey) {
  var table = PMR_readTail_(PMR_SHEETS.DAILY, 80);
  var dateIdx = PMR_col_(table.headers, 'Date');
  if (dateIdx < 0) {
    return null;
  }
  for (var i = table.values.length - 1; i >= 0; i--) {
    if (PMR_dateKeyFast_(table.values[i][dateIdx]) === dateKey) {
      return PMR_rowToReport_(table.headers, table.values[i]);
    }
  }
  return null;
}

function PMR_monthSales_(dateKey) {
  var table = PMR_readTail_(PMR_SHEETS.DAILY, 80);
  var dateIdx = PMR_col_(table.headers, 'Date');
  var month = String(dateKey || '').slice(0, 7);
  var totals = { retailSales: 0, wholesaleSales: 0, internalSales: 0, lostSalesDollars: 0, emergencyOrderCount: 0, deliveryFuelCost: 0 };
  if (dateIdx < 0) {
    return totals;
  }
  var rIdx = PMR_col_(table.headers, 'Retail sales $');
  var wIdx = PMR_col_(table.headers, 'Wholesale sales $');
  var iIdx = PMR_col_(table.headers, 'Internal sales $');
  var lIdx = PMR_col_(table.headers, 'Lost sales $');
  var eIdx = PMR_col_(table.headers, 'Emergency / CSO');
  var fIdx = PMR_col_(table.headers, 'Fuel $');
  for (var i = 0; i < table.values.length; i++) {
    var rowDate = PMR_dateKeyFast_(table.values[i][dateIdx]);
    if (rowDate.indexOf(month) === 0 && rowDate <= dateKey) {
      totals.retailSales += PMR_toNumber_(table.values[i][rIdx]);
      totals.wholesaleSales += PMR_toNumber_(table.values[i][wIdx]);
      totals.internalSales += PMR_toNumber_(table.values[i][iIdx]);
      totals.lostSalesDollars += PMR_toNumber_(table.values[i][lIdx]);
      totals.emergencyOrderCount += PMR_toNumber_(table.values[i][eIdx]);
      totals.deliveryFuelCost += PMR_toNumber_(table.values[i][fIdx]);
    }
  }
  totals.totalSales = PMR_roundMoney_(totals.retailSales + totals.wholesaleSales + totals.internalSales);
  return totals;
}

function PMR_buildSummary_(dateKey, report, boards) {
  report = report || PMR_emptyReport_();
  report.date = dateKey;
  var inventory = PMR_toNumber_(report.inventoryValue);
  var limit = PMR_toNumber_(report.capitalLimit) || PMR_DEFAULT_CAPITAL;
  var n6m = PMR_toNumber_(report.n6mValue);
  var wait = PMR_toNumber_(report.counterWaitMinutes);
  var rimActual = PMR_toNumber_(report.rimCompliancePercent);
  var rimTarget = PMR_toNumber_(report.rimTargetPercent) || PMR_DEFAULT_RIM_TARGET;
  var sales = {
    retailSales: PMR_toNumber_(report.retailSales),
    wholesaleSales: PMR_toNumber_(report.wholesaleSales),
    internalSales: PMR_toNumber_(report.internalSales)
  };
  sales.totalSales = PMR_roundMoney_(sales.retailSales + sales.wholesaleSales + sales.internalSales);
  var waitFlag = wait > 7 ? 'crit' : (wait > 5 ? 'warn' : 'ok');
  var capital = {
    inventoryValue: inventory,
    capitalLimit: limit,
    variance: PMR_roundMoney_(inventory - limit),
    utilization: limit > 0 ? inventory / limit : null,
    overCapital: inventory > limit,
    n3mValue: PMR_toNumber_(report.n3mValue),
    n6mValue: n6m,
    overstockValue: PMR_toNumber_(report.overstockValue),
    payablesOpen: PMR_toNumber_(report.payablesOpen),
    n3mShare: inventory > 0 ? PMR_toNumber_(report.n3mValue) / inventory : null,
    n6mShare: inventory > 0 ? n6m / inventory : null,
    overstockShare: inventory > 0 ? PMR_toNumber_(report.overstockValue) / inventory : null
  };
  var rim = { actual: rimActual, target: rimTarget, gap: Math.round((rimTarget - rimActual) * 10) / 10, onTarget: rimActual >= rimTarget };
  boards = boards || { lostSales: [], sopItems: [], backorders: [], cores: [] };
  var lost = PMR_lostSummary_(boards.lostSales || [], dateKey);
  var sop = PMR_sopSummary_(boards.sopItems || [], dateKey);
  var backorders = PMR_boSummary_(boards.backorders || []);
  var cores = PMR_coreSummary_(boards.cores || [], dateKey);
  var month = PMR_monthSales_(dateKey);
  var flags = PMR_buildAlerts_(report, capital, waitFlag, rim, lost, sop, backorders, cores);
  return {
    date: dateKey,
    month: dateKey.slice(0, 7),
    reported: !!report.submittedAt || inventory > 0 || sales.totalSales > 0,
    report: report,
    capital: capital,
    sales: sales,
    wait: waitFlag,
    rim: rim,
    lostSales: lost,
    sop: sop,
    backorders: backorders,
    cores: cores,
    month: { sales: month, lostSalesDollars: month.lostSalesDollars, emergencyOrderCount: month.emergencyOrderCount, deliveryFuelCost: month.deliveryFuelCost },
    flags: flags
  };
}

function PMR_lostSummary_(rows, dateKey) {
  var weekStart = PMR_addDaysFast_(dateKey, -6);
  var open = [];
  var byPart = {};
  (rows || []).forEach(function (row) {
    if (String(row.status || 'open') === 'open') {
      open.push(row);
    }
    var day = row.openedDate || row.date;
    if (day >= weekStart && day <= dateKey) {
      var part = String(row.partNumber || '').toUpperCase();
      if (!part) return;
      if (!byPart[part]) {
        byPart[part] = { partNumber: part, description: row.description || '', hits: 0, dollars: 0 };
      }
      byPart[part].hits += Math.max(1, PMR_toNumber_(row.timesRequested || 1));
      byPart[part].dollars += PMR_toNumber_(row.dollars);
    }
  });
  var repeats = [];
  Object.keys(byPart).forEach(function (part) {
    if (byPart[part].hits >= 2) {
      repeats.push(byPart[part]);
    }
  });
  return { openCount: open.length, repeats: repeats, open: open };
}

function PMR_sopSummary_(rows, dateKey) {
  var rec = [];
  var aged = [];
  var bottleneck = [];
  var agedValue = 0;
  (rows || []).forEach(function (row) {
    if (String(row.status || 'rec') !== 'rec') {
      return;
    }
    var age = PMR_toNumber_(row.ageDays);
    if (!age && (row.receivedDate || row.openedDate)) {
      age = PMR_daysBetween_(row.receivedDate || row.openedDate, dateKey);
    }
    row.ageDays = age;
    row.ageStatus = age >= 14 ? 'crit' : (age >= 7 ? 'warn' : 'ok');
    rec.push(row);
    if (age >= 14) {
      aged.push(row);
      agedValue += PMR_toNumber_(row.dollars);
    }
    if (age >= 7) {
      bottleneck.push(row);
    }
  });
  return { recCount: rec.length, agedCount: aged.length, bottleneckCount: bottleneck.length, agedValue: PMR_roundMoney_(agedValue), rec: rec, aged: aged };
}

function PMR_boSummary_(rows) {
  var open = [];
  var critical = [];
  (rows || []).forEach(function (row) {
    if (String(row.status || 'open') === 'closed') {
      return;
    }
    open.push(row);
    var reason = String(row.reason || '').toLowerCase();
    if (String(row.severity || '') === 'critical' || reason.indexOf('stop') !== -1) {
      critical.push(row);
    }
  });
  return { openCount: open.length, criticalCount: critical.length, open: open, critical: critical };
}

function PMR_coreSummary_(rows, dateKey) {
  var outstanding = [];
  var aged = [];
  var dollars = 0;
  (rows || []).forEach(function (row) {
    if (String(row.status || 'outstanding') !== 'outstanding') {
      return;
    }
    outstanding.push(row);
    dollars += PMR_toNumber_(row.dollars);
    var age = PMR_toNumber_(row.daysOutstanding) || PMR_daysBetween_(row.openedDate, dateKey);
    if (age >= 14) {
      aged.push(row);
    }
  });
  return { openCount: outstanding.length, dollars: PMR_roundMoney_(dollars), agedCount: aged.length, outstanding: outstanding, aged: aged };
}

function PMR_buildAlerts_(report, capital, wait, rim, lost, sop, backorders, cores) {
  var alerts = [];
  if (capital.overCapital) {
    alerts.push({ level: 'crit', area: 'inventory', title: 'Inventory over capital limit', detail: 'On-hand dollars exceed the monthly parts capital limit. CDK MGR → INV.' });
  }
  if (capital.n6mShare && capital.n6mShare >= 0.08) {
    alerts.push({ level: capital.n6mShare >= 0.12 ? 'crit' : 'warn', area: 'obsolescence', title: '90+ day obsolescence is building', detail: 'N6M dead stock is growing. CDK RSM / RST.' });
  }
  if (wait === 'crit' || wait === 'warn') {
    alerts.push({ level: wait, area: 'counter', title: wait === 'crit' ? 'Technician counter wait over 7 minutes' : 'Technician counter wait over 5 minutes', detail: report.counterWaitMinutes + ' minutes at the parts counter.' });
  }
  if (lost.repeats && lost.repeats.length) {
    alerts.push({ level: 'warn', area: 'lost-sales', title: 'Repeat lost sales — override the matrix', detail: lost.repeats[0].partNumber + ' hit LSL ' + lost.repeats[0].hits + ' times this week.' });
  }
  if (sop.agedCount > 0) {
    alerts.push({ level: 'crit', area: 'sop', title: 'Special orders sitting past 14 days', detail: sop.agedCount + ' REC parts risk becoming non-returnable. CDK SOP → RO.' });
  }
  if (!rim.onTarget) {
    alerts.push({ level: 'warn', area: 'rim', title: 'GM RIM below target', detail: rim.actual + '% vs ' + rim.target + '% target. CDK IRE.' });
  }
  if (PMR_toNumber_(report.emergencyOrderCount) >= 5) {
    alerts.push({ level: 'warn', area: 'orders', title: 'High emergency / CSO freight', detail: report.emergencyOrderCount + ' emergency/CSO orders. CDK ORD.' });
  }
  if (backorders.criticalCount > 0) {
    alerts.push({ level: 'crit', area: 'backorder', title: 'Critical backorders holding vehicles', detail: backorders.criticalCount + ' stop-sale or bay-blocking parts.' });
  }
  if (cores.agedCount > 0 || cores.dollars >= 1500) {
    alerts.push({ level: cores.agedCount > 0 ? 'crit' : 'warn', area: 'cores', title: 'Outstanding cores are uncollected cash', detail: 'CDK CRA. Return cores before they sit on the shop floor.' });
  }
  var critCount = 0;
  var warnCount = 0;
  alerts.forEach(function (item) {
    if (item.level === 'crit') critCount += 1;
    if (item.level === 'warn') warnCount += 1;
  });
  return { alerts: alerts, critCount: critCount, warnCount: warnCount, ok: alerts.length === 0 };
}

function PMR_addDaysFast_(dateKey, days) {
  var parts = String(dateKey || '').split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() + Number(days || 0));
  return PMR_dateKeyFast_(date);
}

function PMR_loadBoards_() {
  return {
    lostSales: PMR_listLostSales('all'),
    sopItems: PMR_listSop('all'),
    backorders: PMR_listBackorders('all'),
    cores: PMR_listCores('all')
  };
}

function PMR_loadBriefing(dateKey) {
  var key = PMR_dateKeyFast_(dateKey) || PMR_toDateKey_(dateKey);
  var stored = PMR_briefStoreGet_(key);
  if (stored && stored.summary) {
    return stored;
  }
  var report = PMR_recallDaily_(key) || PMR_emptyReport_();
  var boards = PMR_loadBoards_();
  var summary = PMR_buildSummary_(key, report, boards);
  var payload = { summary: summary, lostSales: boards.lostSales, sopItems: boards.sopItems, backorders: boards.backorders, cores: boards.cores };
  PMR_briefStorePut_(key, payload);
  return payload;
}

function PMR_getSummary(dateKey) {
  return PMR_loadBriefing(dateKey).summary;
}

function PMR_saveDailyReport(payload) {
  payload = payload || {};
  var dateKey = PMR_toDateKey_(payload.date);
  var cfg = PMR_getConfig();
  var capitalLimit = payload.capitalLimit != null && payload.capitalLimit !== '' ? PMR_toNumber_(payload.capitalLimit) : cfg.capitalLimit;
  var rimTarget = payload.rimTargetPercent != null && payload.rimTargetPercent !== '' ? PMR_toNumber_(payload.rimTargetPercent) : cfg.rimTargetPercent;
  PMR_setConfigValue_('Capital limit', capitalLimit);
  PMR_setConfigValue_('RIM target', rimTarget);
  if (payload.to) {
    PMR_setConfigValue_('Report email', String(payload.to).trim());
  }
  var row = [[
    dateKey,
    PMR_toNumber_(payload.inventoryValue),
    capitalLimit,
    PMR_toNumber_(payload.payablesOpen),
    PMR_toNumber_(payload.n3mValue),
    PMR_toNumber_(payload.n6mValue),
    PMR_toNumber_(payload.overstockValue),
    PMR_toNumber_(payload.retailSales),
    PMR_toNumber_(payload.wholesaleSales),
    PMR_toNumber_(payload.internalSales),
    PMR_toNumber_(payload.counterWaitMinutes),
    PMR_toNumber_(payload.lostSalesCount),
    PMR_toNumber_(payload.lostSalesDollars),
    PMR_toNumber_(payload.sopReceivedCount),
    PMR_toNumber_(payload.sopAgedCount),
    PMR_toNumber_(payload.sopAgedValue),
    PMR_toNumber_(payload.rimCompliancePercent),
    rimTarget,
    PMR_toNumber_(payload.emergencyOrderCount),
    PMR_toNumber_(payload.emergencyFreightCost),
    PMR_toNumber_(payload.outstandingCoresValue),
    PMR_toNumber_(payload.wholesaleStops),
    PMR_toNumber_(payload.hotshotRuns),
    PMR_toNumber_(payload.deliveryFuelCost),
    payload.notes || '',
    payload.submittedBy || 'Parts Manager',
    payload.submittedAt || PMR_nowIso_()
  ]];
  PMR_replaceDateRows_(PMR_sheet_(PMR_SHEETS.DAILY), 'Date', dateKey, row, PMR_HEADERS.DAILY);
  PMR_clearBriefCache_(dateKey);
  var report = PMR_rowToReport_(PMR_HEADERS.DAILY, row[0]);
  var boards = PMR_loadBoards_();
  var summary = PMR_buildSummary_(dateKey, report, boards);
  PMR_briefStorePut_(dateKey, { summary: summary, lostSales: boards.lostSales, sopItems: boards.sopItems, backorders: boards.backorders, cores: boards.cores });
  return summary;
}

function PMR_nextId_(prefix, sheetName, idHeader, dateKey) {
  var full = prefix + '-' + dateKey.replace(/-/g, '') + '-';
  var table = PMR_readTail_(sheetName, 80);
  var idIdx = PMR_col_(table.headers, idHeader);
  var maxSeq = 0;
  if (idIdx >= 0) {
    for (var i = 0; i < table.values.length; i++) {
      var id = String(table.values[i][idIdx] || '');
      if (id.indexOf(full) !== 0) continue;
      var seq = Number(id.slice(full.length));
      if (isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  var next = String(maxSeq + 1);
  while (next.length < 3) next = '0' + next;
  return full + next;
}

function PMR_listFromSheet_(sheetName, mapper) {
  var table = PMR_readTail_(sheetName, 150);
  var rows = [];
  for (var i = 0; i < table.values.length; i++) {
    var rec = mapper(table.headers, table.values[i]);
    if (rec && rec.id) {
      rows.push(rec);
    }
  }
  return rows;
}

function PMR_objectFromRow_(headers, values) {
  var obj = {};
  headers.forEach(function (header, idx) {
    obj[header] = values[idx];
  });
  return obj;
}

function PMR_listLostSales(status) {
  var rows = PMR_listFromSheet_(PMR_SHEETS.LOST, function (headers, values) {
    var row = PMR_objectFromRow_(headers, values);
    return {
      id: String(row['Item ID'] || ''),
      kind: 'lost',
      openedDate: PMR_dateKeyFast_(row['Opened date']),
      partNumber: row['Part number'] || '',
      description: row.Description || '',
      requestedBy: row['Requested by'] || '',
      source: row.Source || '',
      timesRequested: PMR_toNumber_(row['Times requested']) || 1,
      dollars: PMR_toNumber_(row.Dollars),
      status: String(row.Status || 'open').toLowerCase(),
      notes: row.Notes || '',
      closedAt: row['Closed at'] || '',
      updatedAt: row['Updated at'] || ''
    };
  });
  if (status === 'open') {
    return rows.filter(function (row) { return row.status === 'open'; });
  }
  return rows;
}

function PMR_addLostSale(payload) {
  payload = payload || {};
  var part = String(payload.partNumber || '').trim().toUpperCase();
  if (!part) {
    throw new Error('Lost sale part number is required.');
  }
  var openedDate = PMR_toDateKey_(payload.openedDate || payload.date);
  var id = payload.id || PMR_nextId_('LSL', PMR_SHEETS.LOST, 'Item ID', openedDate);
  var now = PMR_nowIso_();
  PMR_sheet_(PMR_SHEETS.LOST).appendRow([
    id, openedDate, part, payload.description || '', payload.requestedBy || '', payload.source || 'service',
    Math.max(1, PMR_toNumber_(payload.timesRequested || 1)), PMR_toNumber_(payload.dollars), 'open',
    payload.notes || '', '', now
  ]);
  PMR_clearBriefCache_(openedDate);
  return { id: id, partNumber: part, status: 'open', openedDate: openedDate };
}

function PMR_listSop(status) {
  var key = PMR_todayKey_();
  var rows = PMR_listFromSheet_(PMR_SHEETS.SOP, function (headers, values) {
    var row = PMR_objectFromRow_(headers, values);
    var received = PMR_dateKeyFast_(row['Received date']);
    var rec = {
      id: String(row['Item ID'] || ''),
      kind: 'sop',
      receivedDate: received,
      openedDate: received,
      partNumber: row['Part number'] || '',
      description: row.Description || '',
      customer: row.Customer || '',
      roNumber: row['RO number'] || '',
      dollars: PMR_toNumber_(row.Dollars),
      status: String(row.Status || 'rec').toLowerCase(),
      notes: row.Notes || '',
      closedAt: row['Closed at'] || '',
      updatedAt: row['Updated at'] || ''
    };
    rec.ageDays = received ? PMR_daysBetween_(received, key) : 0;
    rec.ageStatus = rec.ageDays >= 14 ? 'crit' : (rec.ageDays >= 7 ? 'warn' : 'ok');
    return rec;
  });
  if (status === 'open') {
    return rows.filter(function (row) { return row.status === 'rec'; });
  }
  return rows;
}

function PMR_addSop(payload) {
  payload = payload || {};
  var part = String(payload.partNumber || '').trim().toUpperCase();
  if (!part) {
    throw new Error('SOP part number is required.');
  }
  var receivedDate = PMR_toDateKey_(payload.receivedDate || payload.date);
  var id = payload.id || PMR_nextId_('SOP', PMR_SHEETS.SOP, 'Item ID', receivedDate);
  var now = PMR_nowIso_();
  PMR_sheet_(PMR_SHEETS.SOP).appendRow([
    id, receivedDate, part, payload.description || '', payload.customer || '', payload.roNumber || '',
    PMR_toNumber_(payload.dollars), 'rec', payload.notes || '', '', now
  ]);
  PMR_clearBriefCache_(receivedDate);
  return { id: id, partNumber: part, status: 'rec', receivedDate: receivedDate };
}

function PMR_listBackorders(status) {
  var rows = PMR_listFromSheet_(PMR_SHEETS.BACKORDERS, function (headers, values) {
    var row = PMR_objectFromRow_(headers, values);
    return {
      id: String(row['Item ID'] || ''),
      kind: 'backorder',
      openedDate: PMR_dateKeyFast_(row['Opened date']),
      partNumber: row['Part number'] || '',
      description: row.Description || '',
      vehicle: row.Vehicle || '',
      reason: row.Reason || '',
      eta: row.ETA || '',
      severity: String(row.Severity || 'high').toLowerCase(),
      status: String(row.Status || 'open').toLowerCase(),
      notes: row.Notes || '',
      receivedAt: row['Received at'] || '',
      closedAt: row['Closed at'] || '',
      updatedAt: row['Updated at'] || ''
    };
  });
  if (status === 'open') {
    return rows.filter(function (row) { return row.status !== 'closed'; });
  }
  return rows;
}

function PMR_addBackorder(payload) {
  payload = payload || {};
  var part = String(payload.partNumber || '').trim().toUpperCase();
  if (!part) {
    throw new Error('Backorder part number is required.');
  }
  var openedDate = PMR_toDateKey_(payload.openedDate || payload.date);
  var id = payload.id || PMR_nextId_('BO', PMR_SHEETS.BACKORDERS, 'Item ID', openedDate);
  var now = PMR_nowIso_();
  var severity = String(payload.severity || 'high').toLowerCase();
  PMR_sheet_(PMR_SHEETS.BACKORDERS).appendRow([
    id, openedDate, part, payload.description || '', payload.vehicle || '', payload.reason || 'service bay',
    payload.eta || '', severity, 'open', payload.notes || '', '', '', now
  ]);
  PMR_clearBriefCache_(openedDate);
  return { id: id, partNumber: part, status: 'open', severity: severity };
}

function PMR_listCores(status) {
  var rows = PMR_listFromSheet_(PMR_SHEETS.CORES, function (headers, values) {
    var row = PMR_objectFromRow_(headers, values);
    return {
      id: String(row['Item ID'] || ''),
      kind: 'core',
      openedDate: PMR_dateKeyFast_(row['Opened date']),
      partNumber: row['Part number'] || '',
      description: row.Description || '',
      accountOrTech: row['Account or tech'] || '',
      dollars: PMR_toNumber_(row.Dollars),
      daysOutstanding: PMR_toNumber_(row['Days outstanding']),
      status: String(row.Status || 'outstanding').toLowerCase(),
      notes: row.Notes || '',
      closedAt: row['Closed at'] || '',
      updatedAt: row['Updated at'] || ''
    };
  });
  if (status === 'open' || status === 'outstanding') {
    return rows.filter(function (row) { return row.status === 'outstanding'; });
  }
  return rows;
}

function PMR_addCore(payload) {
  payload = payload || {};
  var part = String(payload.partNumber || '').trim().toUpperCase();
  if (!part) {
    throw new Error('Core part number is required.');
  }
  var openedDate = PMR_toDateKey_(payload.openedDate || payload.date);
  var id = payload.id || PMR_nextId_('CRA', PMR_SHEETS.CORES, 'Item ID', openedDate);
  var now = PMR_nowIso_();
  PMR_sheet_(PMR_SHEETS.CORES).appendRow([
    id, openedDate, part, payload.description || '', payload.accountOrTech || payload.account || '',
    PMR_toNumber_(payload.dollars), PMR_toNumber_(payload.daysOutstanding), 'outstanding',
    payload.notes || '', '', now
  ]);
  PMR_clearBriefCache_(openedDate);
  return { id: id, partNumber: part, status: 'outstanding' };
}

function PMR_updateBoardItem_(sheetName, id, mutator) {
  var sheet = PMR_sheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== String(id)) {
      continue;
    }
    mutator(values[i]);
    sheet.getRange(i + 1, 1, 1, values[i].length).setValues([values[i]]);
    PMR_clearBriefCache_(PMR_todayKey_());
    return true;
  }
  throw new Error('Item ' + id + ' was not found.');
}

function PMR_updateLostSale(id, action) {
  PMR_updateBoardItem_(PMR_SHEETS.LOST, id, function (row) {
    var now = PMR_nowIso_();
    if (action === 'stock' || action === 'stocked') {
      row[8] = 'stocked';
      row[10] = now;
    } else if (action === 'close' || action === 'closed') {
      row[8] = 'closed';
      row[10] = now;
    } else if (action === 'reopen') {
      row[8] = 'open';
      row[10] = '';
    }
    row[11] = now;
  });
  return { id: id, status: action };
}

function PMR_updateSop(id, action) {
  PMR_updateBoardItem_(PMR_SHEETS.SOP, id, function (row) {
    var now = PMR_nowIso_();
    if (action === 'install' || action === 'installed') {
      row[7] = 'installed';
      row[9] = now;
    } else if (action === 'return' || action === 'returned') {
      row[7] = 'returned';
      row[9] = now;
    } else if (action === 'reopen') {
      row[7] = 'rec';
      row[9] = '';
    }
    row[10] = now;
  });
  return { id: id, status: action };
}

function PMR_updateBackorder(id, action) {
  PMR_updateBoardItem_(PMR_SHEETS.BACKORDERS, id, function (row) {
    var now = PMR_nowIso_();
    if (action === 'receive' || action === 'received') {
      row[8] = 'received';
      row[10] = now;
    } else if (action === 'close' || action === 'closed') {
      row[8] = 'closed';
      row[11] = now;
    } else if (action === 'reopen') {
      row[8] = 'open';
      row[11] = '';
    }
    row[12] = now;
  });
  return { id: id, status: action };
}

function PMR_updateCore(id, action) {
  PMR_updateBoardItem_(PMR_SHEETS.CORES, id, function (row) {
    var now = PMR_nowIso_();
    if (action === 'return' || action === 'returned') {
      row[7] = 'returned';
      row[9] = now;
    } else if (action === 'reopen') {
      row[7] = 'outstanding';
      row[9] = '';
    }
    row[10] = now;
  });
  return { id: id, status: action };
}
