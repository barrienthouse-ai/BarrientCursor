/**
 * Data API used by the briefing dialog and dashboard refresh.
 * These functions are safe to call from google.script.run.
 */
function FLM_normalizeReport_(payload) {
  var date = FLM_toDateKey_(payload && payload.date);
  var frontGross = FLM_roundMoney_(payload && payload.frontGross);
  var financeGross = FLM_roundMoney_(payload && payload.financeGross);
  return {
    date: date,
    month: FLM_monthKey_(date),
    soldDeals: Math.max(0, Math.round(FLM_toNumber_(payload && payload.soldDeals))),
    workingDeals: Math.max(0, Math.round(FLM_toNumber_(payload && payload.workingDeals))),
    frontGross: frontGross,
    financeGross: financeGross,
    totalGross: FLM_roundMoney_(frontGross + financeGross),
    deliveries: Math.max(0, Math.round(FLM_toNumber_(payload && payload.deliveries))),
    courtesyDeliveries: Math.max(0, Math.round(FLM_toNumber_(payload && payload.courtesyDeliveries))),
    expectedDeliveries: Math.max(0, Math.round(FLM_toNumber_(payload && payload.expectedDeliveries))),
    notes: String((payload && payload.notes) || ''),
    submittedBy: (payload && payload.submittedBy) || 'Fleet Manager',
    submittedAt: (payload && payload.submittedAt) || FLM_nowIso_(),
    source: (payload && payload.source) || 'manual'
  };
}

function FLM_metrics_(report, goal) {
  goal = goal || {};
  var sold = FLM_toNumber_(report.soldDeals);
  var total = FLM_roundMoney_(report.totalGross);
  return {
    gpu: sold > 0 ? FLM_roundMoney_(total / sold) : null,
    frontGpu: sold > 0 ? FLM_roundMoney_(report.frontGross / sold) : null,
    financeGpu: sold > 0 ? FLM_roundMoney_(report.financeGross / sold) : null,
    unitPace: goal.unitGoal > 0 ? sold / goal.unitGoal : null,
    grossPace: goal.grossGoal > 0 ? total / goal.grossGoal : null
  };
}

function FLM_sumReports_(rows) {
  var acc = {
    soldDeals: 0,
    workingDeals: 0,
    frontGross: 0,
    financeGross: 0,
    totalGross: 0,
    deliveries: 0,
    courtesyDeliveries: 0,
    expectedDeliveries: 0,
    entryCount: 0
  };
  (rows || []).forEach(function (row) {
    acc.soldDeals += FLM_toNumber_(row.soldDeals);
    acc.workingDeals += FLM_toNumber_(row.workingDeals);
    acc.frontGross = FLM_roundMoney_(acc.frontGross + FLM_toNumber_(row.frontGross));
    acc.financeGross = FLM_roundMoney_(acc.financeGross + FLM_toNumber_(row.financeGross));
    acc.totalGross = FLM_roundMoney_(acc.totalGross + FLM_toNumber_(row.totalGross));
    acc.deliveries += FLM_toNumber_(row.deliveries);
    acc.courtesyDeliveries += FLM_toNumber_(row.courtesyDeliveries);
    acc.expectedDeliveries += FLM_toNumber_(row.expectedDeliveries);
    acc.entryCount += 1;
  });
  return acc;
}

function FLM_reportsFromTable_(table) {
  return (table.values || []).map(function (values) {
    return FLM_rowFromDaily_(table.headers, values);
  }).filter(function (row) {
    return Boolean(row.date);
  });
}

function FLM_workingFromTable_(table) {
  return (table.values || []).map(function (values) {
    return FLM_rowFromWorking_(table.headers, values);
  }).filter(function (row) {
    return Boolean(row.id || row.customer || row.account);
  });
}

function FLM_goalsFromTable_(table) {
  return (table.values || []).map(function (values) {
    return FLM_rowFromGoal_(table.headers, values);
  }).filter(function (row) {
    return Boolean(row.month);
  });
}

function FLM_findDaily_(reports, dateKey) {
  var found = null;
  (reports || []).forEach(function (row) {
    if (row.date === dateKey) {
      found = row;
    }
  });
  return found;
}

function FLM_findGoal_(goals, dateKey) {
  var month = String(dateKey || '').slice(0, 7);
  var found = { month: month, unitGoal: 0, grossGoal: 0 };
  (goals || []).forEach(function (row) {
    if (row.month === month) {
      found = row;
    }
  });
  return found;
}

function FLM_isOpenDeal_(deal) {
  var status = String(deal.status || 'working').toLowerCase();
  return status === 'working' || status === 'sold';
}

function FLM_workingSummary_(deals, dateKey) {
  var month = String(dateKey || '').slice(0, 7);
  var open = [];
  var workingUnits = 0;
  var expectedUnits = 0;
  var expectedTodayUnits = 0;
  var soldOpenCount = 0;
  (deals || []).forEach(function (deal) {
    if (!FLM_isOpenDeal_(deal)) {
      return;
    }
    open.push(deal);
    var units = Math.max(1, Math.round(FLM_toNumber_(deal.units) || 1));
    if (String(deal.status).toLowerCase() === 'working') {
      workingUnits += units;
    } else {
      soldOpenCount += 1;
    }
    var expected = FLM_dateKeyFast_(deal.expectedDelivery);
    if (!expected || expected.indexOf(month) === 0) {
      expectedUnits += units;
    }
    if (expected === dateKey) {
      expectedTodayUnits += units;
    }
  });
  return {
    openCount: open.length,
    workingUnits: workingUnits,
    soldOpenCount: soldOpenCount,
    expectedUnits: expectedUnits,
    expectedTodayUnits: expectedTodayUnits,
    open: open
  };
}

function FLM_monday_(dateKey) {
  var parts = String(dateKey || '').split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  var day = date.getDay();
  var diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return FLM_dateKeyFast_(date);
}

function FLM_overlayMonth_(prior, today, goal) {
  prior = prior || {};
  today = today || {};
  var sold = FLM_toNumber_(prior.soldDeals) + FLM_toNumber_(today.soldDeals);
  var front = FLM_roundMoney_(FLM_toNumber_(prior.frontGross) + FLM_toNumber_(today.frontGross));
  var finance = FLM_roundMoney_(FLM_toNumber_(prior.financeGross) + FLM_toNumber_(today.financeGross));
  var totals = {
    soldDeals: sold,
    workingDeals: FLM_toNumber_(today.workingDeals || prior.workingDeals),
    frontGross: front,
    financeGross: finance,
    totalGross: FLM_roundMoney_(FLM_toNumber_(prior.totalGross) + FLM_toNumber_(today.totalGross)),
    deliveries: FLM_toNumber_(prior.deliveries) + FLM_toNumber_(today.deliveries),
    courtesyDeliveries: FLM_toNumber_(prior.courtesyDeliveries) + FLM_toNumber_(today.courtesyDeliveries),
    expectedDeliveries: FLM_toNumber_(today.expectedDeliveries)
  };
  totals.metrics = FLM_metrics_(totals, goal);
  return totals;
}

function FLM_buildSnapshot_(dateKey, reports, workingDeals, goals, dealLog) {
  var key = FLM_toDateKey_(dateKey);
  var month = key.slice(0, 7);
  var weekStart = FLM_monday_(key);
  var weekEnd = FLM_addDaysKey_(weekStart, 5);
  var saved = FLM_findDaily_(reports, key);
  var goal = FLM_findGoal_(goals, key);
  var working = FLM_workingSummary_(workingDeals, key);
  var daily = (dealLog && dealLog.daily) || FLM_emptyTotals_();
  var fromDealLog = daily.dealCount > 0;
  var base = saved || { date: key, workingDeals: working.openCount, expectedDeliveries: working.expectedUnits };
  var report = FLM_normalizeReport_({
    date: key,
    soldDeals: fromDealLog ? daily.soldDeals : base.soldDeals,
    workingDeals: base.workingDeals != null ? base.workingDeals : working.openCount,
    frontGross: fromDealLog ? daily.frontGross : base.frontGross,
    financeGross: fromDealLog ? daily.financeGross : base.financeGross,
    deliveries: base.deliveries,
    courtesyDeliveries: base.courtesyDeliveries,
    expectedDeliveries: base.expectedDeliveries != null ? base.expectedDeliveries : working.expectedUnits,
    notes: base.notes,
    submittedBy: saved ? base.submittedBy : '',
    submittedAt: saved ? base.submittedAt : '',
    source: fromDealLog ? 'deal-log' : (saved ? base.source : 'unsaved')
  });
  var monthRows = (reports || []).filter(function (row) {
    return row.date && row.date.indexOf(month) === 0;
  });
  var weekRows = (reports || []).filter(function (row) {
    return row.date && row.date >= weekStart && row.date <= weekEnd;
  });
  var monthPriorRows = monthRows.filter(function (row) {
    return row.date !== key;
  });
  var monthlyPrior = FLM_sumReports_(monthPriorRows);
  var weekly = FLM_sumReports_(weekRows);
  weekly.metrics = FLM_metrics_(weekly, goal);
  var monthly = FLM_overlayMonth_(monthlyPrior, report, goal);
  return {
    date: key,
    month: month,
    nextBusinessDate: FLM_nextBusinessDay_(key),
    saved: Boolean(saved),
    fromDealLog: fromDealLog,
    unitsSource: fromDealLog ? 'deal-log' : (saved ? 'saved' : 'unsaved'),
    report: report,
    metrics: FLM_metrics_(report, goal),
    goal: goal,
    monthly: monthly,
    monthlyPrior: monthlyPrior,
    weekly: weekly,
    week: { start: weekStart, end: weekEnd, label: 'Selling week (Mon–Sat)' },
    working: working,
    expectedDeliveries: {
      typed: report.expectedDeliveries,
      fromPipeline: working.expectedUnits,
      today: working.expectedTodayUnits,
      total: report.expectedDeliveries || working.expectedUnits
    },
    dealLog: dealLog || FLM_peekDealInput_(key)
  };
}

function FLM_getConfig() {
  return {
    timezone: Session.getScriptTimeZone(),
    submitter: 'Fleet Manager',
    storeName: 'Geaux Chevrolet',
    customers: FLM_DEFAULT_CUSTOMERS.slice()
  };
}

function FLM_getSummary(dateKey) {
  var key = FLM_dateKeyFast_(dateKey) || FLM_toDateKey_(dateKey);
  var reports = FLM_reportsFromTable_(FLM_readDailyTable_());
  var working = FLM_workingFromTable_(FLM_readWorkingTable_());
  var goals = FLM_goalsFromTable_(FLM_readGoalsTable_());
  var dealLog = FLM_peekDealInput_(key);
  return FLM_buildSnapshot_(key, reports, working, goals, dealLog);
}

function FLM_saveDailyReport(payload) {
  var report = FLM_normalizeReport_(payload || {});
  FLM_ensureSheets();
  FLM_upsertDaily_(report);
  var reports = FLM_reportsFromTable_(FLM_readDailyTable_());
  var working = FLM_workingFromTable_(FLM_readWorkingTable_());
  var goals = FLM_goalsFromTable_(FLM_readGoalsTable_());
  var snapshot = FLM_buildSnapshot_(report.date, reports, working, goals, FLM_peekDealInput_(report.date));
  snapshot.saved = true;
  snapshot.report = report;
  snapshot.metrics = FLM_metrics_(report, snapshot.goal);
  FLM_briefStorePut_(report.date, { summary: snapshot, working: working, cached: true });
  try {
    FLM_writeDashboard_(snapshot);
  } catch (ignoreDash) {}
  return snapshot;
}

function FLM_fillFromDealLog(payload) {
  var key = FLM_toDateKey_(payload && payload.date);
  var peek = FLM_peekDealInput_(key);
  var report = FLM_normalizeReport_({
    date: key,
    soldDeals: peek.daily.soldDeals,
    frontGross: peek.daily.frontGross,
    financeGross: peek.daily.financeGross,
    workingDeals: payload && payload.workingDeals,
    deliveries: payload && payload.deliveries,
    courtesyDeliveries: payload && payload.courtesyDeliveries,
    expectedDeliveries: payload && payload.expectedDeliveries,
    notes: payload && payload.notes,
    source: 'deal-log'
  });
  return { report: report, dealLog: peek };
}

function FLM_listHistory() {
  return { rows: FLM_reportsFromTable_(FLM_readDailyTable_()) };
}

function FLM_listWorkingDeals(status) {
  var rows = FLM_workingFromTable_(FLM_readWorkingTable_());
  if (!status || status === 'all') {
    return { rows: rows };
  }
  if (status === 'open') {
    return {
      rows: rows.filter(function (row) {
        return FLM_isOpenDeal_(row);
      })
    };
  }
  return {
    rows: rows.filter(function (row) {
      return String(row.status) === status;
    })
  };
}

function FLM_nextDealId_(existing, dateKey) {
  var prefix = 'FLM-' + String(dateKey || '').replace(/-/g, '') + '-';
  var maxSeq = 0;
  (existing || []).forEach(function (row) {
    var id = String(row.id || '');
    if (id.indexOf(prefix) === 0) {
      var seq = Number(id.slice(prefix.length));
      if (isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });
  var next = String(maxSeq + 1);
  while (next.length < 3) {
    next = '0' + next;
  }
  return prefix + next;
}

function FLM_addWorkingDeal(payload) {
  FLM_ensureSheets();
  var openedDate = FLM_toDateKey_((payload && payload.openedDate) || (payload && payload.date));
  var existing = FLM_workingFromTable_(FLM_readWorkingTable_());
  var front = FLM_roundMoney_(payload && payload.frontGross);
  var finance = FLM_roundMoney_(payload && payload.financeGross);
  var deal = {
    id: (payload && payload.id) || FLM_nextDealId_(existing, openedDate),
    openedDate: openedDate,
    customer: String((payload && payload.customer) || '').trim(),
    account: String((payload && payload.account) || '').trim(),
    stock: String((payload && payload.stock) || '').trim(),
    vehicle: String((payload && payload.vehicle) || '').trim(),
    units: Math.max(1, Math.round(FLM_toNumber_(payload && payload.units) || 1)),
    frontGross: front,
    financeGross: finance,
    totalGross: FLM_roundMoney_(front + finance),
    expectedDelivery: FLM_dateKeyFast_(payload && payload.expectedDelivery) || '',
    status: 'working',
    notes: String((payload && payload.notes) || ''),
    submittedBy: (payload && payload.submittedBy) || 'Fleet Manager',
    updatedAt: FLM_nowIso_()
  };
  if (!deal.customer && !deal.account) {
    throw new Error('Customer or fleet account is required.');
  }
  FLM_appendWorking_(deal);
  return deal;
}

function FLM_updateWorkingDeal(payload) {
  var id = payload && payload.id;
  var action = payload && payload.action;
  var rows = FLM_workingFromTable_(FLM_readWorkingTable_());
  var current = null;
  rows.forEach(function (row) {
    if (row.id === id) {
      current = row;
    }
  });
  if (!current) {
    throw new Error('Working deal ' + id + ' was not found.');
  }
  if (action === 'sold') {
    current.status = 'sold';
  } else if (action === 'deliver') {
    current.status = 'delivered';
  } else if (action === 'dead') {
    current.status = 'dead';
  } else if (action === 'reopen') {
    current.status = 'working';
  } else {
    throw new Error('Unknown working deal action: ' + action);
  }
  current.updatedAt = FLM_nowIso_();
  FLM_upsertWorking_(current);
  return current;
}

function FLM_saveMonthlyGoal(payload) {
  FLM_ensureSheets();
  var month = String((payload && payload.month) || FLM_monthKey_(payload && payload.date)).slice(0, 7);
  var goal = {
    month: month,
    unitGoal: Math.max(0, Math.round(FLM_toNumber_(payload && payload.unitGoal))),
    grossGoal: FLM_roundMoney_(payload && payload.grossGoal),
    notes: String((payload && payload.notes) || ''),
    submittedBy: (payload && payload.submittedBy) || 'Fleet Manager',
    submittedAt: FLM_nowIso_()
  };
  FLM_upsertGoal_(goal);
  return { goal: goal, snapshot: FLM_getSummary((payload && payload.date) || month + '-01') };
}
