/**
 * Data API used by the briefing dialog and dashboard refresh.
 * These functions are safe to call from google.script.run.
 */
function SMR_readRosterFast_() {
  var stored = SMR_rosterStoreGet_();
  if (stored && stored.length) {
    return stored;
  }
  var rosterSheet = SMR_existingSheet_(SMR_SHEETS.ROSTER);
  var roster = [];
  if (rosterSheet && rosterSheet.getLastRow() >= 2) {
    var values = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) {
      var name = String(values[i][0] || '').trim();
      var active = String(values[i][1] || 'Yes').toLowerCase();
      if (name && active !== 'no') {
        roster.push(name);
      }
    }
  }
  if (!roster.length) {
    roster = SMR_DEFAULT_ROSTER.slice();
  }
  SMR_rosterStorePut_(roster);
  return roster;
}

function SMR_getConfig() {
  return {
    roster: SMR_readRosterFast_(),
    timezone: Session.getScriptTimeZone(),
    submitter: 'Service Manager'
  };
}

function SMR_buildBriefingPayload_(key, roster, hoursRows, gross, heat, weekHours, ro) {
  var formRows = SMR_mergeHoursWithRoster_(hoursRows, roster);
  var hourTotals = SMR_sumHourRows_(hoursRows);
  heat = heat || [];
  ro = ro || {};
  var openHeat = 0;
  for (var i = 0; i < heat.length; i++) {
    if (String(heat[i].status || 'open').toLowerCase() !== 'resolved') {
      openHeat += 1;
    }
  }
  var opened = SMR_toNumber_(ro.openedCount != null ? ro.openedCount : ro.writtenCount);
  var closed = SMR_toNumber_(ro.closedCount);
  var openCount = SMR_toNumber_(ro.openCount);
  var payload = {
    roster: roster,
    heat: heat,
    summary: {
      date: key,
      month: key.slice(0, 7),
      techHours: {
        rows: hoursRows,
        formRows: formRows,
        clockHours: hourTotals.clockHours,
        soldHours: hourTotals.soldHours,
        lineCount: hoursRows.length,
        efficiency: hourTotals.clockHours > 0 ? hourTotals.soldHours / hourTotals.clockHours : null
      },
      weekHours: weekHours || SMR_weekHoursFromTable_({ headers: [], values: [] }, key),
      gross: gross,
      repairOrders: {
        openCount: openCount,
        openedCount: opened,
        writtenCount: opened,
        closedCount: closed,
        reported: ro.reported === true || openCount + opened + closed > 0,
        monthly: ro.monthly || { openCount: openCount, openedCount: opened, closedCount: closed }
      },
      heatCases: {
        openCount: openHeat,
        briefedCount: 0,
        awaitingBriefing: openHeat,
        criticalCount: 0,
        resolvedTodayCount: 0,
        open: [],
        resolvedToday: []
      }
    }
  };
  SMR_attachProduction_(payload.summary);
  return payload;
}

function SMR_production_(sold, clock, labor, closed) {
  sold = Math.round(SMR_toNumber_(sold) * 10) / 10;
  clock = Math.round(SMR_toNumber_(clock) * 10) / 10;
  labor = Math.round(SMR_toNumber_(labor) * 100) / 100;
  closed = SMR_toNumber_(closed);
  return {
    soldHours: sold,
    clockHours: clock,
    unappliedHours: Math.round((clock - sold) * 10) / 10,
    laborGross: labor,
    closedCount: closed,
    elr: sold > 0 ? Math.round((labor / sold) * 100) / 100 : null,
    hoursPerRo: closed > 0 ? Math.round((sold / closed) * 10) / 10 : null
  };
}

function SMR_attachProduction_(summary) {
  if (!summary) {
    return;
  }
  var sold = summary.techHours ? summary.techHours.soldHours : 0;
  var clock = summary.techHours ? summary.techHours.clockHours : 0;
  var labor = summary.gross && summary.gross.daily ? summary.gross.daily.laborGross : 0;
  var closed = summary.repairOrders ? summary.repairOrders.closedCount : 0;
  summary.production = SMR_production_(sold, clock, labor, closed);
}

function SMR_recallRoFast_(dateKey) {
  var table = SMR_readTail_(SMR_SHEETS.ROS, 80);
  var dateIdx = SMR_col_(table.headers, 'Date');
  var openIdx = SMR_col_(table.headers, 'Open ROs');
  var closedIdx = SMR_col_(table.headers, 'Closed today');
  var writtenIdx = SMR_col_(table.headers, 'Written today');
  var month = String(dateKey || '').slice(0, 7);
  var result = {
    openCount: 0,
    openedCount: 0,
    writtenCount: 0,
    closedCount: 0,
    reported: false,
    monthly: { openCount: 0, openedCount: 0, closedCount: 0 }
  };
  if (dateIdx < 0) {
    return result;
  }
  for (var i = 0; i < table.values.length; i++) {
    var rowDate = SMR_dateKeyFast_(table.values[i][dateIdx]);
    if (!rowDate) {
      continue;
    }
    var opened = writtenIdx >= 0 ? SMR_toNumber_(table.values[i][writtenIdx]) : 0;
    var closed = closedIdx >= 0 ? SMR_toNumber_(table.values[i][closedIdx]) : 0;
    var openCount = openIdx >= 0 ? SMR_toNumber_(table.values[i][openIdx]) : 0;
    if (rowDate.indexOf(month) === 0) {
      result.monthly.openedCount += opened;
      result.monthly.closedCount += closed;
    }
    if (rowDate === dateKey) {
      result.openCount = openCount;
      result.openedCount = opened;
      result.writtenCount = opened;
      result.closedCount = closed;
      result.reported = true;
      result.monthly.openCount = openCount;
    }
  }
  return result;
}

function SMR_recallClosedFast_(dateKey) {
  return SMR_recallRoFast_(dateKey).closedCount;
}

function SMR_loadBriefing(dateKey) {
  var key = SMR_dateKeyFast_(dateKey) || SMR_toDateKey_(dateKey);
  var stored = SMR_briefStoreGet_(key);
  if (stored && stored.summary && stored.summary.weekHours) {
    if (!stored.summary.repairOrders || !stored.summary.repairOrders.monthly) {
      stored.summary.repairOrders = SMR_recallRoFast_(key);
    }
    SMR_attachProduction_(stored.summary);
    return stored;
  }
  var table = SMR_readTail_(SMR_SHEETS.TECH_HOURS, 300);
  if (stored && stored.summary) {
    stored.summary.weekHours = SMR_weekHoursFromTable_(table, key);
    if (!stored.summary.repairOrders || !stored.summary.repairOrders.monthly) {
      stored.summary.repairOrders = SMR_recallRoFast_(key);
    }
    SMR_attachProduction_(stored.summary);
    return stored;
  }

  var roster = SMR_rosterStoreGet_() || SMR_DEFAULT_ROSTER.slice();
  var hoursRows = SMR_hoursFromTable_(table, key, key);
  var weekHours = SMR_weekHoursFromTable_(table, key);
  var gross = SMR_recallGrossFast_(key);
  var ro = SMR_recallRoFast_(key);
  var payload = SMR_buildBriefingPayload_(key, roster, hoursRows, gross, [], weekHours, ro);
  SMR_briefStorePut_(key, payload);
  return payload;
}

function SMR_sumHourRows_(rows) {
  var clock = 0;
  var sold = 0;
  (rows || []).forEach(function (row) {
    clock += SMR_toNumber_(row.clockHours);
    sold += SMR_toNumber_(row.soldHours);
  });
  return { clockHours: Math.round(clock * 10) / 10, soldHours: Math.round(sold * 10) / 10 };
}

function SMR_sumRoRows_(rows) {
  var totals = { openCount: 0, closedCount: 0, writtenCount: 0 };
  (rows || []).forEach(function (row) {
    totals.openCount += SMR_toNumber_(row.openCount);
    totals.closedCount += SMR_toNumber_(row.closedCount);
    totals.writtenCount += SMR_toNumber_(row.writtenCount);
  });
  return totals;
}

function SMR_hoursFromTable_(table, startKey, endKey) {
  var dateIdx = SMR_col_(table.headers, 'Date');
  var nameIdx = SMR_col_(table.headers, 'Tech name');
  var clockIdx = SMR_col_(table.headers, 'Clock hours');
  var soldIdx = SMR_col_(table.headers, 'Sold hours');
  if (dateIdx < 0 || nameIdx < 0) {
    return [];
  }
  var rows = [];
  for (var i = 0; i < table.values.length; i++) {
    var rowDate = SMR_dateKeyFast_(table.values[i][dateIdx]);
    if (!rowDate || rowDate < startKey || rowDate > endKey) {
      continue;
    }
    rows.push({
      date: rowDate,
      techName: table.values[i][nameIdx],
      clockHours: SMR_toNumber_(table.values[i][clockIdx]),
      soldHours: SMR_toNumber_(table.values[i][soldIdx]),
      notes: ''
    });
  }
  return rows;
}

function SMR_rollupWeekFromTable_(table, dateKey, mode) {
  var range = mode === 'payroll' ? SMR_payrollWeekRange_(dateKey) : SMR_soldWeekRange_(dateKey);
  var rows = SMR_hoursFromTable_(table, range.start, range.end);
  var byName = {};
  rows.forEach(function (row) {
    var name = String(row.techName || '').trim();
    if (!name) {
      return;
    }
    var add = mode === 'payroll' ? row.clockHours : row.soldHours;
    byName[name] = Math.round(((byName[name] || 0) + add) * 10) / 10;
  });
  var list = [];
  var total = 0;
  Object.keys(byName).forEach(function (name) {
    list.push({ techName: name, hours: byName[name] });
    total += byName[name];
  });
  return {
    start: range.start,
    end: range.end,
    mode: mode,
    label: range.label,
    rows: list,
    total: Math.round(total * 10) / 10
  };
}

function SMR_weekHoursFromTable_(table, dateKey) {
  return {
    sold: SMR_rollupWeekFromTable_(table, dateKey, 'sold'),
    payroll: SMR_rollupWeekFromTable_(table, dateKey, 'payroll')
  };
}

function SMR_recallTechHoursFast_(dateKey) {
  return SMR_hoursFromTable_(SMR_readTail_(SMR_SHEETS.TECH_HOURS, 300), dateKey, dateKey);
}

function SMR_recallGrossFast_(dateKey) {
  var table = SMR_readTail_(SMR_SHEETS.GROSS, 120);
  var dateIdx = SMR_col_(table.headers, 'Date');
  var periodIdx = SMR_col_(table.headers, 'Period');
  var laborIdx = SMR_col_(table.headers, 'Labor gross');
  var otherIdx = SMR_col_(table.headers, 'Other gross');
  var month = dateKey.slice(0, 7);
  var daily = { laborGross: 0, partsGross: 0, otherGross: 0, totalGross: 0 };
  var monthly = { laborGross: 0, partsGross: 0, otherGross: 0, totalGross: 0, source: 'daily-sum' };
  if (dateIdx < 0) {
    return { daily: daily, monthly: monthly };
  }
  for (var i = 0; i < table.values.length; i++) {
    var rowDate = SMR_dateKeyFast_(table.values[i][dateIdx]);
    var period = String(table.values[i][periodIdx] || 'daily').toLowerCase();
    var labor = SMR_toNumber_(table.values[i][laborIdx]);
    var other = SMR_toNumber_(table.values[i][otherIdx]);
    var total = labor + other;
    if (period === 'daily' && rowDate === dateKey) {
      daily = { laborGross: labor, partsGross: 0, otherGross: other, totalGross: total };
    }
    if (period === 'daily' && rowDate.indexOf(month) === 0) {
      monthly.laborGross += labor;
      monthly.otherGross += other;
      monthly.totalGross += total;
    }
    if (period === 'monthly' && rowDate.indexOf(month) === 0) {
      monthly = { laborGross: labor, partsGross: 0, otherGross: other, totalGross: total, source: 'override' };
    }
  }
  return { daily: daily, monthly: monthly };
}

function SMR_countOpenHeatFast_() {
  var table = SMR_readTail_(SMR_SHEETS.HEAT, 150);
  var statusIdx = SMR_col_(table.headers, 'Status');
  if (statusIdx < 0) {
    return 0;
  }
  var open = 0;
  for (var i = 0; i < table.values.length; i++) {
    if (String(table.values[i][statusIdx] || 'open').toLowerCase() !== 'resolved') {
      open += 1;
    }
  }
  return open;
}

function SMR_recallTechHours(dateKey) {
  var key = SMR_toDateKey_(dateKey);
  return SMR_readObjects_(SMR_existingSheet_(SMR_SHEETS.TECH_HOURS)).filter(function (row) {
    return SMR_toDateKey_(row.Date) === key;
  }).map(function (row) {
    return {
      date: key,
      techName: row['Tech name'],
      clockHours: SMR_toNumber_(row['Clock hours']),
      soldHours: SMR_toNumber_(row['Sold hours']),
      openCount: SMR_toNumber_(row['Open ROs']),
      closedCount: SMR_toNumber_(row['Closed today']),
      writtenCount: SMR_toNumber_(row['Written today']),
      notes: row.Notes || ''
    };
  });
}

function SMR_saveTechHours(payload) {
  payload = payload || {};
  var dateKey = SMR_toDateKey_(payload.date);
  var submittedAt = payload.submittedAt || SMR_nowIso_();
  var submittedBy = payload.submittedBy || 'Service Manager';
  var rows = (payload.rows || []).filter(function (row) {
    return String(row.techName || '').trim();
  }).map(function (row) {
    return [
      dateKey,
      String(row.techName).trim(),
      SMR_toNumber_(row.clockHours),
      SMR_toNumber_(row.soldHours),
      SMR_toNumber_(row.openCount),
      SMR_toNumber_(row.closedCount),
      SMR_toNumber_(row.writtenCount),
      row.notes || '',
      submittedBy,
      submittedAt
    ];
  });
  SMR_replaceDateRows_(SMR_sheet_(SMR_SHEETS.TECH_HOURS), 'Date', dateKey, rows, SMR_HEADERS.TECH_HOURS);
  SMR_clearBriefCache_(dateKey);
  return { date: dateKey };
}

function SMR_saveGross(payload) {
  payload = payload || {};
  var period = payload.period === 'monthly' ? 'monthly' : 'daily';
  var dateKey = SMR_toDateKey_(payload.date);
  var month = payload.month || SMR_monthKey_(dateKey);
  var labor = SMR_toNumber_(payload.laborGross);
  var other = SMR_toNumber_(payload.otherGross);
  var row = [[
    period === 'monthly' ? month + '-01' : dateKey,
    month,
    period,
    labor,
    0,
    other,
    labor + other,
    payload.notes || '',
    payload.submittedBy || 'Service Manager',
    payload.submittedAt || SMR_nowIso_()
  ]];
  var sheet = SMR_sheet_(SMR_SHEETS.GROSS);
  var values = sheet.getDataRange().getValues();
  var kept = [SMR_HEADERS.GROSS];
  for (var i = 1; i < values.length; i++) {
    var existingPeriod = String(values[i][2] || '');
    var existingDate = SMR_toDateKey_(values[i][0]);
    var existingMonth = String(values[i][1] || SMR_monthKey_(existingDate));
    var drop = period === 'monthly'
      ? existingPeriod === 'monthly' && existingMonth === month
      : existingPeriod === 'daily' && existingDate === dateKey;
    if (!drop) {
      kept.push(values[i]);
    }
  }
  kept.push(row[0]);
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, SMR_HEADERS.GROSS.length).setValues(kept);
  sheet.setFrozenRows(1);
  SMR_clearBriefCache_(dateKey);
  return { date: dateKey };
}

function SMR_saveRepairOrders(payload) {
  payload = payload || {};
  var dateKey = SMR_toDateKey_(payload.date);
  var row = [[
    dateKey,
    SMR_toNumber_(payload.openCount),
    SMR_toNumber_(payload.closedCount),
    SMR_toNumber_(payload.writtenCount != null && payload.writtenCount !== '' ? payload.writtenCount : payload.openedCount),
    payload.notes || '',
    payload.submittedBy || 'Service Manager',
    payload.submittedAt || SMR_nowIso_()
  ]];
  SMR_replaceDateRows_(SMR_sheet_(SMR_SHEETS.ROS), 'Date', dateKey, row, SMR_HEADERS.ROS);
  SMR_clearBriefCache_(dateKey);
  return { date: dateKey };
}

function SMR_saveDailyReport(payload) {
  payload = payload || {};
  var dateKey = SMR_toDateKey_(payload.date);
  var previousHeat = [];
  var previous = SMR_briefStoreGet_(dateKey);
  if (previous && previous.heat) {
    previousHeat = previous.heat;
  }
  if (payload.techHours) {
    var hourRows = payload.techHours.rows || payload.techHours;
    SMR_saveTechHours({ date: dateKey, rows: hourRows, submittedBy: payload.submittedBy });
  }
  if (payload.repairOrders) {
    SMR_saveRepairOrders(Object.assign({ date: dateKey }, payload.repairOrders, { submittedBy: payload.submittedBy }));
  }
  if (payload.gross) {
    SMR_saveGross(Object.assign({ date: dateKey, period: 'daily' }, payload.gross, { submittedBy: payload.submittedBy }));
  }
  var roster = SMR_rosterStoreGet_() || SMR_DEFAULT_ROSTER.slice();
  var hourRows = (payload.techHours && (payload.techHours.rows || payload.techHours)) || [];
  var labor = payload.gross ? SMR_toNumber_(payload.gross.laborGross) : 0;
  var other = payload.gross ? SMR_toNumber_(payload.gross.otherGross) : 0;
  var gross = SMR_recallGrossFast_(dateKey);
  if (!gross.daily.totalGross && (labor || other)) {
    gross.daily = { laborGross: labor, partsGross: 0, otherGross: other, totalGross: labor + other };
  }
  var weekHours = SMR_weekHoursFromTable_(SMR_readTail_(SMR_SHEETS.TECH_HOURS, 300), dateKey);
  var ro = payload.repairOrders ? {
    openCount: SMR_toNumber_(payload.repairOrders.openCount),
    closedCount: SMR_toNumber_(payload.repairOrders.closedCount),
    writtenCount: SMR_toNumber_(payload.repairOrders.writtenCount != null && payload.repairOrders.writtenCount !== ''
      ? payload.repairOrders.writtenCount
      : payload.repairOrders.openedCount),
    openedCount: SMR_toNumber_(payload.repairOrders.openedCount != null && payload.repairOrders.openedCount !== ''
      ? payload.repairOrders.openedCount
      : payload.repairOrders.writtenCount)
  } : { openCount: 0, closedCount: 0, writtenCount: 0, openedCount: 0, reported: false };
  if (payload.repairOrders) {
    ro.reported = true;
  }
  var recalled = SMR_recallRoFast_(dateKey);
  ro.monthly = recalled.monthly;
  var briefing = SMR_buildBriefingPayload_(dateKey, roster, hourRows, gross, previousHeat, weekHours, ro);
  SMR_briefStorePut_(dateKey, briefing);
  return briefing.summary;
}

function SMR_addHeatCase(payload) {
  payload = payload || {};
  var issue = String(payload.issue || '').trim();
  if (!issue) {
    throw new Error('Heat case issue is required.');
  }
  var openedDate = SMR_toDateKey_(payload.openedDate || payload.date);
  var id = payload.id || SMR_nextHeatId_(openedDate);
  var now = SMR_nowIso_();
  var advisor = String(payload.advisor || payload.owner || '').trim();
  var technician = String(payload.technician || '').trim();
  var heatSheet = SMR_sheet_(SMR_SHEETS.HEAT);
  SMR_upgradeHeatHeader_(heatSheet);
  heatSheet.appendRow([
    id,
    openedDate,
    payload.customer || '',
    payload.roNumber || '',
    payload.vehicle || '',
    issue,
    String(payload.severity || 'medium').toLowerCase(),
    advisor,
    'open',
    '',
    '',
    '',
    now,
    advisor,
    technician
  ]);
  var rec = {
    id: id,
    openedDate: openedDate,
    customer: payload.customer || '',
    roNumber: payload.roNumber || '',
    vehicle: payload.vehicle || '',
    issue: issue,
    severity: String(payload.severity || 'medium').toLowerCase(),
    owner: advisor,
    advisor: advisor,
    technician: technician,
    status: 'open',
    briefedAt: '',
    resolvedAt: '',
    resolutionNotes: '',
    updatedAt: now
  };
  SMR_briefStorePatchHeat_(openedDate);
  return rec;
}

function SMR_updateHeatCase(id, action, notes) {
  var sheet = SMR_sheet_(SMR_SHEETS.HEAT);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== String(id)) {
      continue;
    }
    var status = String(values[i][8] || 'open').toLowerCase();
    var now = SMR_nowIso_();
    if (action === 'brief') {
      if (status === 'resolved') {
        throw new Error('Resolved heat cases cannot be marked briefed.');
      }
      values[i][8] = 'briefed';
      if (!values[i][9]) {
        values[i][9] = now;
      }
    } else if (action === 'resolve') {
      values[i][8] = 'resolved';
      if (!values[i][9]) {
        values[i][9] = now;
      }
      values[i][10] = now;
      values[i][11] = notes || values[i][11] || '';
    } else if (action === 'reopen') {
      values[i][8] = 'open';
      values[i][10] = '';
    } else {
      throw new Error('Unknown heat case action: ' + action);
    }
    values[i][12] = now;
    sheet.getRange(i + 1, 1, 1, values[i].length).setValues([values[i]]);
    var updated = SMR_rowToHeat_(values[0], values[i]);
    SMR_briefStorePatchHeat_(SMR_toDateKey_(values[i][1]) || SMR_todayKey_());
    return updated;
  }
  throw new Error('Heat case ' + id + ' was not found.');
}

function SMR_listHeatCases(status) {
  status = status || 'all';
  var table = SMR_readTail_(SMR_SHEETS.HEAT, 150);
  if (!table.headers.length) {
    return [];
  }
  var objects = [];
  for (var i = 0; i < table.values.length; i++) {
    var rec = SMR_rowToHeat_(table.headers, table.values[i]);
    if (!rec.id) {
      continue;
    }
    if (status === 'open' && rec.status === 'resolved') {
      continue;
    }
    if (status === 'resolved' && rec.status !== 'resolved') {
      continue;
    }
    objects.push(rec);
  }
  return objects;
}

function SMR_briefStorePatchHeat_(dateKey) {
  var stored = SMR_briefStoreGet_(dateKey);
  if (!stored || !stored.summary) {
    return;
  }
  var cases = SMR_listHeatCases('all');
  stored.heat = cases;
  stored.summary.heatCases = stored.summary.heatCases || {};
  var open = 0;
  for (var i = 0; i < cases.length; i++) {
    if (cases[i].status !== 'resolved') {
      open += 1;
    }
  }
  stored.summary.heatCases.openCount = open;
  stored.summary.heatCases.awaitingBriefing = open;
  stored.cached = false;
  SMR_briefStorePut_(dateKey, stored);
}

function SMR_getSummary(dateKey, roster) {
  var key = SMR_toDateKey_(dateKey);
  var month = SMR_monthKey_(key);
  var hoursRows = SMR_recallTechHours(key);
  var formRows = SMR_mergeHoursWithRoster_(hoursRows, roster || SMR_readRosterFast_());
  var clock = 0;
  var sold = 0;
  hoursRows.forEach(function (row) {
    clock += SMR_toNumber_(row.clockHours);
    sold += SMR_toNumber_(row.soldHours);
  });
  clock = Math.round(clock * 10) / 10;
  sold = Math.round(sold * 10) / 10;
  var roOpen = 0;
  var roClosed = 0;
  var roWritten = 0;
  hoursRows.forEach(function (row) {
    roOpen += SMR_toNumber_(row.openCount);
    roClosed += SMR_toNumber_(row.closedCount);
    roWritten += SMR_toNumber_(row.writtenCount);
  });
  var hasTechRos = roOpen + roClosed + roWritten > 0;
  var grossRows = SMR_readObjects_(SMR_existingSheet_(SMR_SHEETS.GROSS));
  var dailyGross = { laborGross: 0, partsGross: 0, otherGross: 0, totalGross: 0 };
  var monthFromDailies = { laborGross: 0, partsGross: 0, otherGross: 0, totalGross: 0 };
  var monthlyOverride = null;
  grossRows.forEach(function (row) {
    var period = String(row.Period || '').toLowerCase();
    var date = SMR_toDateKey_(row.Date);
    var rowMonth = String(row.Month || SMR_monthKey_(date));
    var labor = SMR_toNumber_(row['Labor gross']);
    var other = SMR_toNumber_(row['Other gross']);
    var total = labor + other;
    if (period === 'daily' && date === key) {
      dailyGross = { laborGross: labor, partsGross: 0, otherGross: other, totalGross: total };
    }
    if (period === 'daily' && date.indexOf(month) === 0) {
      monthFromDailies.laborGross += labor;
      monthFromDailies.otherGross += other;
      monthFromDailies.totalGross += total;
    }
    if (period === 'monthly' && rowMonth === month) {
      monthlyOverride = { laborGross: labor, partsGross: 0, otherGross: other, totalGross: total };
    }
  });
  var allRos = SMR_readObjects_(SMR_existingSheet_(SMR_SHEETS.ROS));
  var mtdOpened = 0;
  var mtdClosed = 0;
  var ro = null;
  allRos.forEach(function (row) {
    var date = SMR_toDateKey_(row.Date);
    if (date.indexOf(month) === 0) {
      mtdOpened += SMR_toNumber_(row['Written today']);
      mtdClosed += SMR_toNumber_(row['Closed today']);
    }
    if (date === key) {
      ro = row;
    }
  });
  var heat = SMR_listHeatCases('all');
  var open = heat.filter(function (row) { return row.status !== 'resolved'; });
  var briefed = open.filter(function (row) { return row.status === 'briefed'; });
  var resolvedToday = heat.filter(function (row) {
    return row.status === 'resolved' && String(row.resolvedAt || '').indexOf(key) === 0;
  });
  var summary = {
    date: key,
    month: month,
    techHours: {
      rows: hoursRows,
      formRows: formRows,
      clockHours: clock,
      soldHours: sold,
      lineCount: hoursRows.length,
      efficiency: clock > 0 ? sold / clock : null
    },
    gross: {
      date: key,
      month: month,
      daily: dailyGross,
      monthly: monthlyOverride || Object.assign({ source: 'daily-sum' }, monthFromDailies),
      monthFromDailies: monthFromDailies
    },
    weekHours: SMR_weekHoursFromTable_(SMR_readTail_(SMR_SHEETS.TECH_HOURS, 300), key),
    repairOrders: {
      openCount: ro ? SMR_toNumber_(ro['Open ROs']) : (hasTechRos ? roOpen : 0),
      openedCount: ro ? SMR_toNumber_(ro['Written today']) : (hasTechRos ? roWritten : 0),
      closedCount: ro ? SMR_toNumber_(ro['Closed today']) : (hasTechRos ? roClosed : 0),
      writtenCount: ro ? SMR_toNumber_(ro['Written today']) : (hasTechRos ? roWritten : 0),
      reported: !!ro || hasTechRos,
      row: ro,
      monthly: {
        openCount: ro ? SMR_toNumber_(ro['Open ROs']) : (hasTechRos ? roOpen : 0),
        openedCount: mtdOpened,
        closedCount: mtdClosed
      }
    },
    heatCases: {
      openCount: open.length,
      briefedCount: briefed.length,
      awaitingBriefing: open.length - briefed.length,
      criticalCount: open.filter(function (row) { return row.severity === 'critical'; }).length,
      resolvedTodayCount: resolvedToday.length,
      open: open,
      resolvedToday: resolvedToday
    }
  };
  SMR_attachProduction_(summary);
  return summary;
}

function SMR_mergeHoursWithRoster_(savedRows, roster) {
  roster = roster && roster.length ? roster : SMR_DEFAULT_ROSTER;
  var byName = {};
  (savedRows || []).forEach(function (row) {
    var key = String(row.techName || '').trim().toUpperCase();
    if (key) {
      byName[key] = row;
    }
  });
  var used = {};
  var merged = roster.map(function (name) {
    var key = String(name).trim().toUpperCase();
    used[key] = true;
    var existing = byName[key];
    return {
      techName: name,
      clockHours: existing ? existing.clockHours : 8,
      soldHours: existing ? existing.soldHours : '',
      openCount: existing ? existing.openCount : '',
      closedCount: existing ? existing.closedCount : '',
      writtenCount: existing ? existing.writtenCount : '',
      notes: existing ? existing.notes || '' : ''
    };
  });
  (savedRows || []).forEach(function (row) {
    var key = String(row.techName || '').trim().toUpperCase();
    if (key && !used[key]) {
      merged.push(row);
    }
  });
  return merged;
}

function SMR_nextHeatId_(dateKey) {
  var prefix = 'HEAT-' + dateKey.replace(/-/g, '') + '-';
  var table = SMR_readTail_(SMR_SHEETS.HEAT, 80);
  var idIdx = SMR_col_(table.headers, 'Case ID');
  var maxSeq = 0;
  if (idIdx >= 0) {
    for (var i = 0; i < table.values.length; i++) {
      var id = String(table.values[i][idIdx] || '');
      if (id.indexOf(prefix) !== 0) {
        continue;
      }
      var seq = Number(id.slice(prefix.length));
      if (isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  var next = String(maxSeq + 1);
  while (next.length < 3) {
    next = '0' + next;
  }
  return prefix + next;
}

function SMR_objectToHeat_(row) {
  var advisor = String(row.Advisor || row.Owner || '').trim();
  return {
    id: String(row['Case ID'] || ''),
    openedDate: SMR_toDateKey_(row['Opened date']),
    customer: row.Customer || '',
    roNumber: row['RO number'] || '',
    vehicle: row.Vehicle || '',
    issue: row.Issue || '',
    severity: String(row.Severity || 'medium').toLowerCase(),
    owner: advisor,
    advisor: advisor,
    technician: String(row.Technician || '').trim(),
    status: String(row.Status || 'open').toLowerCase(),
    briefedAt: row['Briefed at'] || '',
    resolvedAt: row['Resolved at'] || '',
    resolutionNotes: row['Resolution notes'] || '',
    updatedAt: row['Updated at'] || ''
  };
}

function SMR_rowToHeat_(headers, values) {
  var obj = {};
  headers.forEach(function (header, idx) {
    obj[header] = values[idx];
  });
  return SMR_objectToHeat_(obj);
}
