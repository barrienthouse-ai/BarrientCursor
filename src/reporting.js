/**
 * Pure reporting helpers shared by the API and tests.
 * These functions do not touch disk or Google Sheets.
 */

export const CLOSED_WEEKDAYS = [0]; // Sunday — Geaux Chevrolet is open Monday–Saturday

export function toDateKey(input, now = new Date()) {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return formatDateKey(input);
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  if (typeof input === 'string' && input.trim()) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateKey(parsed);
    }
  }
  return formatDateKey(now);
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthKey(dateKey) {
  return toDateKey(dateKey).slice(0, 7);
}

export function parseDateKey(dateKey) {
  const key = toDateKey(dateKey);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateKey, days) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + Number(days || 0));
  return formatDateKey(date);
}

export function weekday(dateKey) {
  return parseDateKey(dateKey).getDay();
}

export function nextBusinessDay(dateKey, closedWeekdays = CLOSED_WEEKDAYS) {
  let key = addDays(dateKey, 1);
  for (let i = 0; i < 8; i += 1) {
    if (!closedWeekdays.includes(weekday(key))) {
      return key;
    }
    key = addDays(key, 1);
  }
  return key;
}

export function mondayOfWeek(dateKey) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDateKey(date);
}

export function sellingWeekRange(dateKey) {
  const start = mondayOfWeek(dateKey);
  return {
    start,
    end: addDays(start, 5),
    label: 'Selling week (Mon–Sat)'
  };
}

export function inDateRange(dateKey, start, end) {
  const key = toDateKey(dateKey);
  return key >= start && key <= end;
}

export function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[$,%\s]/g, ''));
  return Number.isFinite(num) ? num : fallback;
}

export function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

export function isRetailType(value) {
  return String(value || '').trim().toUpperCase() === 'RETAIL';
}

export function classifyDept(value) {
  const dept = String(value || '').trim().toUpperCase();
  if (dept === 'NEW') {
    return 'new';
  }
  if (dept === 'USED') {
    return 'used';
  }
  return 'other';
}

export function emptySalesTotals() {
  return {
    newSold: 0,
    usedSold: 0,
    totalSold: 0,
    frontGross: 0,
    backGross: 0,
    totalGross: 0,
    dealCount: 0
  };
}

export function emptyTraffic() {
  return {
    appointments: 0,
    shownAppointments: 0,
    showroomVisits: 0,
    nextDayAppointments: 0
  };
}

function addSale(bucket, rec) {
  if (rec.dept === 'new') {
    bucket.newSold += rec.units;
  } else if (rec.dept === 'used') {
    bucket.usedSold += rec.units;
  } else {
    return;
  }
  bucket.dealCount += 1;
  bucket.frontGross = roundMoney(bucket.frontGross + rec.front);
  bucket.backGross = roundMoney(bucket.backGross + rec.back);
  bucket.totalGross = roundMoney(bucket.totalGross + rec.total);
  bucket.totalSold = bucket.newSold + bucket.usedSold;
}

export function summarizeDealLog(deals = [], dateKey, options = {}) {
  const key = dateKey ? toDateKey(dateKey) : null;
  const month = key ? monthKey(key) : null;
  const retailOnly = options.retailOnly !== false;
  const daily = emptySalesTotals();
  const monthly = emptySalesTotals();
  const rows = [];

  for (const deal of deals) {
    if (!deal) {
      continue;
    }
    const type = deal.type || deal.TYPE || deal.saleType;
    if (retailOnly && !isRetailType(type)) {
      continue;
    }
    const dealDate = toDateKey(deal.date || deal.DATE);
    const dept = classifyDept(deal.dept || deal.DEPT || deal.newUsed);
    const front = roundMoney(deal.frontGross ?? deal.front ?? deal.fTotal ?? deal['F TOTAL']);
    const back = roundMoney(deal.backGross ?? deal.back ?? deal.finTotal ?? deal['FIN TOTAL']);
    const total = roundMoney(deal.totalGross ?? deal.total ?? deal['TOTAL GROSS'] ?? front + back);
    const units = Math.max(1, Math.round(toNumber(deal.unit ?? deal.UNIT, 1)));
    const rec = {
      date: dealDate,
      dealNumber: deal.deal || deal.DEAL || deal.dealNumber || '',
      stock: deal.stock || deal.STOCK || '',
      type: String(type || '').trim(),
      dept,
      front,
      back,
      total,
      units,
      salesPerson: deal.sales1 || deal['SALES 1'] || deal.salesPerson || ''
    };
    if (key && dealDate === key) {
      addSale(daily, rec);
      if (dept === 'new' || dept === 'used') {
        rows.push(rec);
      }
    }
    if (month && dealDate.startsWith(month)) {
      addSale(monthly, rec);
    }
  }

  return { date: key, month, daily, monthly, rows };
}

export function showRate(shown, appointments) {
  const appts = toNumber(appointments);
  if (appts <= 0) {
    return null;
  }
  return toNumber(shown) / appts;
}

export function closeRate(sold, visits) {
  const visitsCount = toNumber(visits);
  if (visitsCount <= 0) {
    return null;
  }
  return toNumber(sold) / visitsCount;
}

export function perRetailUnit(amount, sold) {
  const units = toNumber(sold);
  if (units <= 0) {
    return null;
  }
  return roundMoney(toNumber(amount) / units);
}

export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) {
    return '—';
  }
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatMoney(value) {
  const amount = roundMoney(value);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function reportMetrics(report = {}) {
  const totalSold = toNumber(report.totalSold ?? toNumber(report.newSold) + toNumber(report.usedSold));
  return {
    showRate: showRate(report.shownAppointments, report.appointments),
    closeRate: closeRate(totalSold, report.showroomVisits),
    frontPvr: perRetailUnit(report.frontGross, totalSold),
    backPvr: perRetailUnit(report.backGross, totalSold),
    totalPvr: perRetailUnit(report.totalGross, totalSold)
  };
}

export function normalizeDailyReport(payload = {}, now = new Date()) {
  const date = toDateKey(payload.date, now);
  const newSold = Math.max(0, Math.round(toNumber(payload.newSold)));
  const usedSold = Math.max(0, Math.round(toNumber(payload.usedSold)));
  const frontGross = roundMoney(payload.frontGross);
  const backGross = roundMoney(payload.backGross);
  const totalGross = roundMoney(frontGross + backGross);
  const appointments = Math.max(0, Math.round(toNumber(payload.appointments)));
  const shownAppointments = Math.max(0, Math.round(toNumber(payload.shownAppointments)));
  const showroomVisits = Math.max(0, Math.round(toNumber(payload.showroomVisits)));
  const nextDayAppointments = Math.max(0, Math.round(toNumber(payload.nextDayAppointments)));
  const report = {
    date,
    month: monthKey(date),
    newSold,
    usedSold,
    totalSold: newSold + usedSold,
    frontGross,
    backGross,
    totalGross,
    appointments,
    shownAppointments,
    showroomVisits,
    nextDayAppointments,
    nextBusinessDate: payload.nextBusinessDate || nextBusinessDay(date),
    notes: String(payload.notes || '').trim(),
    submittedBy: payload.submittedBy || 'Sales Manager',
    submittedAt: payload.submittedAt || now.toISOString(),
    source: payload.source || 'manual'
  };
  return {
    ...report,
    metrics: reportMetrics(report)
  };
}

export function sumReports(rows = []) {
  return rows.reduce(
    (acc, row) => {
      acc.newSold += toNumber(row.newSold);
      acc.usedSold += toNumber(row.usedSold);
      acc.totalSold += toNumber(row.totalSold ?? toNumber(row.newSold) + toNumber(row.usedSold));
      acc.frontGross = roundMoney(acc.frontGross + toNumber(row.frontGross));
      acc.backGross = roundMoney(acc.backGross + toNumber(row.backGross));
      acc.totalGross = roundMoney(acc.totalGross + toNumber(row.totalGross));
      acc.appointments += toNumber(row.appointments);
      acc.shownAppointments += toNumber(row.shownAppointments);
      acc.showroomVisits += toNumber(row.showroomVisits);
      acc.nextDayAppointments += toNumber(row.nextDayAppointments);
      acc.entryCount += 1;
      return acc;
    },
    {
      ...emptySalesTotals(),
      ...emptyTraffic(),
      entryCount: 0
    }
  );
}

export function findDailyReport(rows = [], dateKey) {
  const key = toDateKey(dateKey);
  const matches = rows.filter((row) => row.date === key);
  return matches.length ? matches[matches.length - 1] : null;
}

export function rollupReports(reports = [], dateKey) {
  const key = toDateKey(dateKey);
  const month = monthKey(key);
  const week = sellingWeekRange(key);
  const daily = findDailyReport(reports, key);
  const monthRows = reports.filter((row) => typeof row.date === 'string' && row.date.startsWith(month));
  const weekRows = reports.filter((row) => inDateRange(row.date, week.start, week.end));
  const monthly = sumReports(monthRows);
  const weekly = sumReports(weekRows);
  return {
    date: key,
    month,
    week,
    daily,
    monthly: { ...monthly, metrics: reportMetrics(monthly) },
    weekly: { ...weekly, metrics: reportMetrics(weekly) }
  };
}

export function prefillsFromDealLog(dealSummary, traffic = {}) {
  const daily = dealSummary?.daily || emptySalesTotals();
  return normalizeDailyReport({
    date: dealSummary?.date,
    newSold: daily.newSold,
    usedSold: daily.usedSold,
    frontGross: daily.frontGross,
    backGross: daily.backGross,
    ...emptyTraffic(),
    ...traffic,
    source: 'deal-log'
  });
}

export function buildDailySnapshot({ dateKey, reports = [], dealLog = [], now = new Date() }) {
  const key = toDateKey(dateKey, now);
  const saved = findDailyReport(reports, key);
  const dealHint = summarizeDealLog(dealLog, key);
  const report = saved
    ? normalizeDailyReport(saved, now)
    : prefillsFromDealLog(dealHint, { date: key, source: 'unsaved' });
  if (!saved) {
    report.source = dealHint.daily.dealCount ? 'deal-log' : 'unsaved';
    report.submittedAt = '';
    report.submittedBy = '';
  }
  const rollup = rollupReports(reports, key);
  return {
    date: key,
    month: monthKey(key),
    nextBusinessDate: nextBusinessDay(key),
    saved: Boolean(saved),
    report,
    metrics: report.metrics,
    monthly: rollup.monthly,
    weekly: rollup.weekly,
    week: rollup.week,
    dealLog: dealHint
  };
}

export function reservedSheetNames() {
  return ['SLM_Dashboard', 'SLM_Daily', 'SLM_Config'];
}

export function geauxProtectedSheetNames() {
  return [
    'HOME',
    'SUMMARY',
    'DEALINPUT',
    'salesreview',
    'NEWVEHICLES',
    'INV',
    'TREND',
    'SETTLEUP',
    'MANAGER',
    'SALESREP',
    'LOGDEAL',
    'DESKDATA',
    'Deals_Database',
    'DEALGROSS',
    'DEALVEHICLE',
    'DEALCUSTOMER',
    'SERVICE BOARD',
    'SVC_RO',
    'SVC_RO_LINES',
    'ADMIN_EMPLOYEES',
    'EMAIL_QUEUE',
    'QUOTE_STORE',
    'DO NOT DELETE - AutoCrat Job Se',
    'SMR_Dashboard',
    'SMR_TechHours',
    'SMR_Gross',
    'SMR_HeatCases',
    'SMR_RepairOrders',
    'SMR_Roster',
    'SMR_Config'
  ];
}

export function reservedFunctionPrefixes() {
  return ['SLM_'];
}

export function reservedSimpleTriggers() {
  return ['onOpen', 'onEdit', 'onInstall', 'onSelectionChange', 'onChange', 'doGet', 'doPost'];
}

export function auditWorkbook({ sheetNames = [], functionNames = [] }) {
  const reservedSheets = reservedSheetNames();
  const collisions = [];

  for (const name of sheetNames) {
    if (reservedSheets.includes(name)) {
      collisions.push({
        type: 'sheet',
        name,
        severity: 'info',
        message: `${name} is an SLM sheet. Install will reuse it and will not rename or delete it.`
      });
    }
  }

  for (const name of functionNames) {
    if (reservedSimpleTriggers().includes(name)) {
      collisions.push({
        type: 'trigger',
        name,
        severity: 'keep',
        message: `Existing ${name} will be left untouched. Call SLM_onOpen() from your current onOpen if you want the menu.`
      });
    }
    if (name.startsWith('SLM_')) {
      collisions.push({
        type: 'function',
        name,
        severity: 'info',
        message: `${name} is part of the Sales Manager Report namespace.`
      });
    }
  }

  const existingNonSlmSheets = sheetNames.filter((name) => !name.startsWith('SLM_'));
  const protectedHits = sheetNames.filter((name) => geauxProtectedSheetNames().includes(name));
  protectedHits.forEach((name) => {
    collisions.push({
      type: 'protected-sheet',
      name,
      severity: 'keep',
      message: `${name} is an existing Geaux Chevrolet tab. SLM will not write, rename, hide, or delete it.`
    });
  });

  return {
    reservedSheets,
    existingNonSlmSheets,
    protectedHits,
    collisions,
    safeToInstall: collisions.every((item) => item.severity !== 'block'),
    notes: [
      'SLM never defines onOpen, onEdit, doGet, or doPost.',
      'SLM never deletes, hides, or renames existing non-SLM sheets.',
      'SLM writes only to SLM_* tabs and ScriptProperties keys prefixed with SLM_.',
      'Retail new/used units and gross can be read from DEALINPUT. Traffic numbers are typed by the sales manager.'
    ]
  };
}
