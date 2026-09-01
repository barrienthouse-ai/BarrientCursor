/**
 * Data API used by the recap dialog and dashboard refresh.
 * These functions are safe to call from google.script.run.
 */
function SLM_normalizeReport_(payload) {
  var date = SLM_toDateKey_(payload && payload.date);
  var newSold = Math.max(0, Math.round(SLM_toNumber_(payload && payload.newSold)));
  var usedSold = Math.max(0, Math.round(SLM_toNumber_(payload && payload.usedSold)));
  var frontGross = SLM_roundMoney_(payload && payload.frontGross);
  var backGross = SLM_roundMoney_(payload && payload.backGross);
  return {
    date: date,
    month: SLM_monthKey_(date),
    newSold: newSold,
    usedSold: usedSold,
    totalSold: newSold + usedSold,
    frontGross: frontGross,
    backGross: backGross,
    totalGross: SLM_roundMoney_(frontGross + backGross),
    appointments: Math.max(0, Math.round(SLM_toNumber_(payload && payload.appointments))),
    shownAppointments: Math.max(0, Math.round(SLM_toNumber_(payload && payload.shownAppointments))),
    showroomVisits: Math.max(0, Math.round(SLM_toNumber_(payload && payload.showroomVisits))),
    nextDayAppointments: Math.max(0, Math.round(SLM_toNumber_(payload && payload.nextDayAppointments))),
    nextBusinessDate: (payload && payload.nextBusinessDate) || SLM_nextBusinessDay_(date),
    notes: String((payload && payload.notes) || ''),
    submittedBy: (payload && payload.submittedBy) || 'Sales Manager',
    submittedAt: (payload && payload.submittedAt) || SLM_nowIso_(),
    source: (payload && payload.source) || 'manual'
  };
}

function SLM_metrics_(report) {
  var showRate = report.appointments > 0 ? report.shownAppointments / report.appointments : null;
  var closeRate = report.showroomVisits > 0 ? report.totalSold / report.showroomVisits : null;
  var pvr = function (amount) {
    return report.totalSold > 0 ? SLM_roundMoney_(amount / report.totalSold) : null;
  };
  return {
    showRate: showRate,
    closeRate: closeRate,
    frontPvr: pvr(report.frontGross),
    backPvr: pvr(report.backGross),
    totalPvr: pvr(report.totalGross)
  };
}

function SLM_sumReports_(rows) {
  var acc = SLM_emptyTotals_();
  acc.appointments = 0;
  acc.shownAppointments = 0;
  acc.showroomVisits = 0;
  acc.nextDayAppointments = 0;
  acc.entryCount = 0;
  (rows || []).forEach(function (row) {
    acc.newSold += SLM_toNumber_(row.newSold);
    acc.usedSold += SLM_toNumber_(row.usedSold);
    acc.totalSold += SLM_toNumber_(row.totalSold);
    acc.frontGross = SLM_roundMoney_(acc.frontGross + SLM_toNumber_(row.frontGross));
    acc.backGross = SLM_roundMoney_(acc.backGross + SLM_toNumber_(row.backGross));
    acc.totalGross = SLM_roundMoney_(acc.totalGross + SLM_toNumber_(row.totalGross));
    acc.appointments += SLM_toNumber_(row.appointments);
    acc.shownAppointments += SLM_toNumber_(row.shownAppointments);
    acc.showroomVisits += SLM_toNumber_(row.showroomVisits);
    acc.nextDayAppointments += SLM_toNumber_(row.nextDayAppointments);
    acc.entryCount += 1;
  });
  return acc;
}

function SLM_reportsFromTable_(table) {
  return (table.values || []).map(function (values) {
    return SLM_rowFromValues_(table.headers, values);
  }).filter(function (row) {
    return Boolean(row.date);
  });
}

function SLM_findDaily_(reports, dateKey) {
  var found = null;
  (reports || []).forEach(function (row) {
    if (row.date === dateKey) {
      found = row;
    }
  });
  return found;
}

function SLM_monday_(dateKey) {
  var parts = String(dateKey || '').split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  var day = date.getDay();
  var diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return SLM_dateKeyFast_(date);
}

function SLM_buildSnapshot_(dateKey, reports, dealLog) {
  var key = SLM_toDateKey_(dateKey);
  var month = key.slice(0, 7);
  var weekStart = SLM_monday_(key);
  var weekEnd = SLM_addDaysKey_(weekStart, 5);
  var saved = SLM_findDaily_(reports, key);
  var daily = (dealLog && dealLog.daily) || SLM_emptyTotals_();
  var fromDealLog = daily.dealCount > 0;
  var base = saved || { date: key };
  var report = SLM_normalizeReport_({
    date: key,
    newSold: fromDealLog ? daily.newSold : base.newSold,
    usedSold: fromDealLog ? daily.usedSold : base.usedSold,
    frontGross: fromDealLog ? daily.frontGross : base.frontGross,
    backGross: fromDealLog ? daily.backGross : base.backGross,
    appointments: base.appointments,
    shownAppointments: base.shownAppointments,
    showroomVisits: base.showroomVisits,
    nextDayAppointments: base.nextDayAppointments,
    nextBusinessDate: base.nextBusinessDate,
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
  var monthly = SLM_sumReports_(monthRows);
  var weekly = SLM_sumReports_(weekRows);
  return {
    date: key,
    month: month,
    nextBusinessDate: SLM_nextBusinessDay_(key),
    saved: Boolean(saved),
    fromDealLog: fromDealLog,
    unitsSource: fromDealLog ? 'deal-log' : (saved ? 'saved' : 'unsaved'),
    report: report,
    metrics: SLM_metrics_(report),
    monthly: monthly,
    weekly: weekly,
    week: { start: weekStart, end: weekEnd, label: 'Selling week (Mon–Sat)' },
    dealLog: dealLog || SLM_peekDealInput_(key)
  };
}

function SLM_getSummary(dateKey) {
  var key = SLM_dateKeyFast_(dateKey) || SLM_toDateKey_(dateKey);
  var reports = SLM_reportsFromTable_(SLM_readDailyTable_());
  var dealLog = SLM_peekDealInput_(key);
  var snapshot = SLM_buildSnapshot_(key, reports, dealLog);
  SLM_briefStorePut_(key, snapshot);
  return snapshot;
}

function SLM_saveDailyReport(payload) {
  var report = SLM_normalizeReport_(payload || {});
  SLM_ensureSheets();
  SLM_upsertDaily_(report);
  var reports = SLM_reportsFromTable_(SLM_readDailyTable_());
  var snapshot = SLM_buildSnapshot_(report.date, reports, SLM_peekDealInput_(report.date));
  snapshot.saved = true;
  snapshot.report = report;
  snapshot.metrics = SLM_metrics_(report);
  SLM_briefStorePut_(report.date, snapshot);
  try {
    SLM_refreshDashboard();
  } catch (ignoreDash) {}
  return snapshot;
}

function SLM_fillFromDealLog(payload) {
  var key = SLM_toDateKey_(payload && payload.date);
  var peek = SLM_peekDealInput_(key);
  var report = SLM_normalizeReport_({
    date: key,
    newSold: peek.daily.newSold,
    usedSold: peek.daily.usedSold,
    frontGross: peek.daily.frontGross,
    backGross: peek.daily.backGross,
    appointments: payload && payload.appointments,
    shownAppointments: payload && payload.shownAppointments,
    showroomVisits: payload && payload.showroomVisits,
    nextDayAppointments: payload && payload.nextDayAppointments,
    notes: payload && payload.notes,
    source: 'deal-log'
  });
  return { report: report, dealLog: peek };
}

function SLM_listHistory() {
  return { rows: SLM_reportsFromTable_(SLM_readDailyTable_()) };
}
