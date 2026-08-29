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

function SMR_buildBriefingPayload_(key, roster, hoursRows, gross, heat) {
  var formRows = SMR_mergeHoursWithRoster_(hoursRows, roster);
  var hourTotals = SMR_sumHourRows_(hoursRows);
  var roTotals = SMR_sumRoRows_(hoursRows);
  heat = heat || [];
  var openHeat = 0;
  for (var i = 0; i < heat.length; i++) {
    if (String(heat[i].status || 'open').toLowerCase() !== 'resolved') {
      openHeat += 1;
    }
  }
  return {
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
      gross: gross,
      repairOrders: {
        openCount: roTotals.openCount,
        closedCount: roTotals.closedCount,
        writtenCount: roTotals.writtenCount,
        reported: roTotals.openCount + roTotals.closedCount + roTotals.writtenCount > 0
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
}

function SMR_loadBriefing(dateKey) {
  var key = SMR_dateKeyFast_(dateKey) || SMR_toDateKey_(dateKey);
  var stored = SMR_briefStoreGet_(key);
  if (stored && stored.summary) {
    return stored;
  }

  var roster = SMR_rosterStoreGet_() || SMR_DEFAULT_ROSTER.slice();
  var hoursRows = SMR_recallTechHoursFast_(key);
  var gross = SMR_recallGrossFast_(key);
  var payload = SMR_buildBriefingPayload_(key, roster, hoursRows, gross, []);
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

function SMR_recallTechHoursFast_(dateKey) {
  var table = SMR_readTail_(SMR_SHEETS.TECH_HOURS, 300);
  var dateIdx = SMR_col_(table.headers, 'Date');
  var nameIdx = SMR_col_(table.headers, 'Tech name');
  var clockIdx = SMR_col_(table.headers, 'Clock hours');
  var soldIdx = SMR_col_(table.headers, 'Sold hours');
  var openIdx = SMR_col_(table.headers, 'Open ROs');
  var closedIdx = SMR_col_(table.headers, 'Closed today');
  var writtenIdx = SMR_col_(table.headers, 'Written today');
  if (dateIdx < 0 || nameIdx < 0) {
    return [];
  }
  var rows = [];
  for (var i = 0; i < table.values.length; i++) {
    if (SMR_dateKeyFast_(table.values[i][dateIdx]) !== dateKey) {
      continue;
    }
    rows.push({
      date: dateKey,
      techName: table.values[i][nameIdx],
      clockHours: SMR_toNumber_(table.values[i][clockIdx]),
      soldHours: SMR_toNumber_(table.values[i][soldIdx]),
      openCount: SMR_toNumber_(table.values[i][openIdx]),
      closedCount: SMR_toNumber_(table.values[i][closedIdx]),
      writtenCount: SMR_toNumber_(table.values[i][writtenIdx]),
      notes: ''
    });
  }
  return rows;
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
    SMR_toNumber_(payload.writtenCount),
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
    var open = 0;
    var closed = 0;
    var written = 0;
    (hourRows || []).forEach(function (row) {
      open += SMR_toNumber_(row.openCount);
      closed += SMR_toNumber_(row.closedCount);
      written += SMR_toNumber_(row.writtenCount);
    });
    SMR_saveRepairOrders({
      date: dateKey,
      openCount: open,
      closedCount: closed,
      writtenCount: written,
      notes: payload.repairOrders ? payload.repairOrders.notes : '',
      submittedBy: payload.submittedBy
    });
  } else if (payload.repairOrders) {
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
  var briefing = SMR_buildBriefingPayload_(dateKey, roster, hourRows, gross, previousHeat);
  briefing.summary.repairOrders.reported = true;
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
  SMR_sheet_(SMR_SHEETS.HEAT).appendRow([
    id,
    openedDate,
    payload.customer || '',
    payload.roNumber || '',
    payload.vehicle || '',
    issue,
    String(payload.severity || 'medium').toLowerCase(),
    payload.owner || '',
    'open',
    '',
    '',
    '',
    now
  ]);
  var rec = {
    id: id,
    openedDate: openedDate,
    customer: payload.customer || '',
    roNumber: payload.roNumber || '',
    vehicle: payload.vehicle || '',
    issue: issue,
    severity: String(payload.severity || 'medium').toLowerCase(),
    owner: payload.owner || '',
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
  var roRows = SMR_readObjects_(SMR_existingSheet_(SMR_SHEETS.ROS)).filter(function (row) {
    return SMR_toDateKey_(row.Date) === key;
  });
  var ro = roRows.length ? roRows[roRows.length - 1] : null;
  var heat = SMR_listHeatCases('all');
  var open = heat.filter(function (row) { return row.status !== 'resolved'; });
  var briefed = open.filter(function (row) { return row.status === 'briefed'; });
  var resolvedToday = heat.filter(function (row) {
    return row.status === 'resolved' && String(row.resolvedAt || '').indexOf(key) === 0;
  });
  return {
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
    repairOrders: {
      openCount: hasTechRos ? roOpen : (ro ? SMR_toNumber_(ro['Open ROs']) : 0),
      closedCount: hasTechRos ? roClosed : (ro ? SMR_toNumber_(ro['Closed today']) : 0),
      writtenCount: hasTechRos ? roWritten : (ro ? SMR_toNumber_(ro['Written today']) : 0),
      reported: hasTechRos || !!ro,
      row: ro
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
  return {
    id: String(row['Case ID'] || ''),
    openedDate: SMR_toDateKey_(row['Opened date']),
    customer: row.Customer || '',
    roNumber: row['RO number'] || '',
    vehicle: row.Vehicle || '',
    issue: row.Issue || '',
    severity: String(row.Severity || 'medium').toLowerCase(),
    owner: row.Owner || '',
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
