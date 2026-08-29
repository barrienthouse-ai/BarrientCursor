/**
 * Data API used by the briefing dialog and dashboard refresh.
 * These functions are safe to call from google.script.run.
 */
function SMR_getConfig() {
  SMR_ensureSheets();
  var rosterRows = SMR_readObjects_(SMR_sheet_(SMR_SHEETS.ROSTER));
  var roster = rosterRows.filter(function (row) {
    return String(row.Active || 'Yes').toLowerCase() !== 'no';
  }).map(function (row) {
    return String(row['Tech name'] || '').trim();
  }).filter(Boolean);
  return {
    roster: roster,
    timezone: Session.getScriptTimeZone(),
    submitter: 'Service Manager'
  };
}

function SMR_recallTechHours(dateKey) {
  var key = SMR_toDateKey_(dateKey);
  return SMR_readObjects_(SMR_sheet_(SMR_SHEETS.TECH_HOURS)).filter(function (row) {
    return SMR_toDateKey_(row.Date) === key;
  }).map(function (row) {
    return {
      date: key,
      techName: row['Tech name'],
      clockHours: SMR_toNumber_(row['Clock hours']),
      soldHours: SMR_toNumber_(row['Sold hours']),
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
      row.notes || '',
      submittedBy,
      submittedAt
    ];
  });
  SMR_replaceDateRows_(SMR_sheet_(SMR_SHEETS.TECH_HOURS), 'Date', dateKey, rows, SMR_HEADERS.TECH_HOURS);
  return SMR_getSummary(dateKey);
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
  return SMR_getSummary(dateKey);
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
  return SMR_getSummary(dateKey);
}

function SMR_saveDailyReport(payload) {
  payload = payload || {};
  var dateKey = SMR_toDateKey_(payload.date);
  if (payload.techHours) {
    SMR_saveTechHours({ date: dateKey, rows: payload.techHours.rows || payload.techHours, submittedBy: payload.submittedBy });
  }
  if (payload.gross) {
    SMR_saveGross(Object.assign({ date: dateKey, period: 'daily' }, payload.gross, { submittedBy: payload.submittedBy }));
  }
  if (payload.repairOrders) {
    SMR_saveRepairOrders(Object.assign({ date: dateKey }, payload.repairOrders, { submittedBy: payload.submittedBy }));
  }
  return SMR_getSummary(dateKey);
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
  return SMR_listHeatCases('all').filter(function (row) { return row.id === id; })[0];
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
    return SMR_rowToHeat_(values[0], values[i]);
  }
  throw new Error('Heat case ' + id + ' was not found.');
}

function SMR_listHeatCases(status) {
  status = status || 'all';
  return SMR_readObjects_(SMR_sheet_(SMR_SHEETS.HEAT)).map(function (row) {
    return SMR_objectToHeat_(row);
  }).filter(function (row) {
    if (status === 'open') {
      return row.status !== 'resolved';
    }
    if (status === 'resolved') {
      return row.status === 'resolved';
    }
    return true;
  });
}

function SMR_getSummary(dateKey) {
  SMR_ensureSheets();
  var key = SMR_toDateKey_(dateKey);
  var month = SMR_monthKey_(key);
  var hoursRows = SMR_recallTechHours(key);
  var formRows = SMR_mergeHoursWithRoster_(hoursRows);
  var clock = 0;
  var sold = 0;
  hoursRows.forEach(function (row) {
    clock += SMR_toNumber_(row.clockHours);
    sold += SMR_toNumber_(row.soldHours);
  });
  var grossRows = SMR_readObjects_(SMR_sheet_(SMR_SHEETS.GROSS));
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
  var roRows = SMR_readObjects_(SMR_sheet_(SMR_SHEETS.ROS)).filter(function (row) {
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
      openCount: ro ? SMR_toNumber_(ro['Open ROs']) : 0,
      closedCount: ro ? SMR_toNumber_(ro['Closed today']) : 0,
      writtenCount: ro ? SMR_toNumber_(ro['Written today']) : 0,
      reported: !!ro,
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

function SMR_mergeHoursWithRoster_(savedRows) {
  var roster = SMR_getConfig().roster;
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
  var maxSeq = 0;
  SMR_listHeatCases('all').forEach(function (row) {
    if (String(row.id).indexOf(prefix) !== 0) {
      return;
    }
    var seq = Number(String(row.id).slice(prefix.length));
    if (isFinite(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  });
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
