/**
 * Pure reporting helpers shared by the API and tests.
 * These functions do not touch disk or Google Sheets.
 */

export const CLOSED_WEEKDAYS = [0]; // Sunday — Geaux Chevrolet is open Monday–Saturday

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function normalizeYear(year) {
  const num = Number(year);
  if (!Number.isFinite(num) || num <= 0) {
    return 0;
  }
  if (num < 100) {
    return num >= 50 ? 1900 + num : 2000 + num;
  }
  // 206 → 2026 so a mistyped year still hits this year's deal log
  if (num < 1000) {
    return 2000 + (num % 100);
  }
  return num;
}

export function chicagoDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function parseSheetDateKey(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0) {
      return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
    }
    return chicagoDateKey(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const serial = Math.floor(value);
    if (serial > 20000 && serial < 80000) {
      const ms = Date.UTC(1899, 11, 30) + serial * 86400000;
      const excel = new Date(ms);
      return `${excel.getUTCFullYear()}-${pad2(excel.getUTCMonth() + 1)}-${pad2(excel.getUTCDate())}`;
    }
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const iso = text.slice(0, 10);
    const year = normalizeYear(Number(iso.slice(0, 4)));
    return `${year}-${iso.slice(5)}`;
  }
  const us = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = normalizeYear(us[3]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  return '';
}

export function toDateKey(input, now = new Date()) {
  const parsed = parseSheetDateKey(input);
  if (parsed) {
    return parsed;
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

export function lastFilledDealIndex(typeDeptRows = []) {
  for (let i = typeDeptRows.length - 1; i >= 0; i -= 1) {
    const type = String(typeDeptRows[i]?.[0] || '').trim();
    const dept = String(typeDeptRows[i]?.[1] || '').trim();
    if (type || dept) {
      return i;
    }
  }
  return -1;
}

export function findDateSpan(dateKeys = [], dateKey) {
  let first = -1;
  let last = -1;
  for (let i = 0; i < dateKeys.length; i += 1) {
    if (dateKeys[i] === dateKey) {
      if (first < 0) {
        first = i;
      }
      last = i;
    }
  }
  return first < 0 ? null : { start: first, end: last };
}

/** Count TYPE/DEPT cells read by the exponential last-deal scan (never the formula tail). */
export function lastDealScanCellsRead(typeDeptRows = []) {
  let cursor = 0;
  let size = 80;
  let cells = 0;
  let found = -1;
  while (cursor < typeDeptRows.length) {
    const end = Math.min(typeDeptRows.length, cursor + size);
    cells += end - cursor;
    const slice = typeDeptRows.slice(cursor, end);
    const local = lastFilledDealIndex(slice);
    if (local < 0) {
      break;
    }
    found = cursor + local;
    if (found < end - 1) {
      break;
    }
    cursor = found + 1;
    size = Math.min(size * 2, 400);
  }
  return { found, cells };
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
  let lastRetailDate = '';

  for (const deal of deals) {
    if (!deal) {
      continue;
    }
    const type = deal.type || deal.TYPE || deal.saleType;
    if (retailOnly && !isRetailType(type)) {
      continue;
    }
    const dealDate = parseSheetDateKey(deal.date || deal.DATE);
    if (!dealDate) {
      continue;
    }
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
    if (dealDate && (dept === 'new' || dept === 'used') && dealDate > lastRetailDate) {
      lastRetailDate = dealDate;
    }
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

  return { date: key, month, daily, monthly, rows, lastRetailDate };
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

export function overlayMonthToDate(prior = {}, today = {}) {
  const newSold = toNumber(prior.newSold) + toNumber(today.newSold);
  const usedSold = toNumber(prior.usedSold) + toNumber(today.usedSold);
  const totalSold = newSold + usedSold;
  const todayFront = toNumber(today.frontGross);
  const todayBack = toNumber(today.backGross);
  const todayGross = roundMoney(toNumber(today.totalGross, todayFront + todayBack));
  const priorGross = roundMoney(toNumber(prior.totalGross, toNumber(prior.frontGross) + toNumber(prior.backGross)));
  const totals = {
    newSold,
    usedSold,
    totalSold,
    frontGross: roundMoney(toNumber(prior.frontGross) + todayFront),
    backGross: roundMoney(toNumber(prior.backGross) + todayBack),
    totalGross: roundMoney(priorGross + todayGross),
    appointments: toNumber(prior.appointments) + toNumber(today.appointments),
    shownAppointments: toNumber(prior.shownAppointments) + toNumber(today.shownAppointments),
    showroomVisits: toNumber(prior.showroomVisits) + toNumber(today.showroomVisits),
    nextDayAppointments: toNumber(today.nextDayAppointments)
  };
  return { ...totals, metrics: reportMetrics(totals) };
}

export function rollupReports(reports = [], dateKey) {
  const key = toDateKey(dateKey);
  const month = monthKey(key);
  const week = sellingWeekRange(key);
  const daily = findDailyReport(reports, key);
  const monthRows = reports.filter((row) => typeof row.date === 'string' && row.date.startsWith(month));
  const monthPriorRows = monthRows.filter((row) => row.date !== key);
  const weekRows = reports.filter((row) => inDateRange(row.date, week.start, week.end));
  const monthly = sumReports(monthRows);
  const monthlyPrior = sumReports(monthPriorRows);
  const weekly = sumReports(weekRows);
  return {
    date: key,
    month,
    week,
    daily,
    monthly: { ...monthly, metrics: reportMetrics(monthly) },
    monthlyPrior: { ...monthlyPrior, metrics: reportMetrics(monthlyPrior) },
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

export function applyDealLogUnits(base = {}, dealSummary = {}, dateKey, now = new Date(), options = {}) {
  const daily = dealSummary?.daily || emptySalesTotals();
  const fromDealLog = toNumber(daily.dealCount) > 0;
  const saved = Boolean(options.saved);
  const report = normalizeDailyReport(
    {
      ...base,
      date: dateKey || base.date || dealSummary?.date,
      newSold: fromDealLog ? daily.newSold : base.newSold,
      usedSold: fromDealLog ? daily.usedSold : base.usedSold,
      frontGross: fromDealLog ? daily.frontGross : base.frontGross,
      backGross: fromDealLog ? daily.backGross : base.backGross,
      source: fromDealLog ? 'deal-log' : base.source || (saved ? 'manual' : 'unsaved')
    },
    now
  );
  return {
    report,
    fromDealLog,
    unitsSource: fromDealLog ? 'deal-log' : saved ? 'saved' : 'unsaved'
  };
}

export function buildDailySnapshot({ dateKey, reports = [], dealLog = [], now = new Date() }) {
  const key = toDateKey(dateKey, now);
  const saved = findDailyReport(reports, key);
  const dealHint = summarizeDealLog(dealLog, key);
  const merged = applyDealLogUnits(saved || { date: key }, dealHint, key, now, { saved: Boolean(saved) });
  const report = merged.report;
  if (!saved) {
    report.submittedAt = '';
    report.submittedBy = '';
    if (!merged.fromDealLog) {
      report.source = 'unsaved';
    }
  }
  const rollup = rollupReports(reports, key);
  return {
    date: key,
    month: monthKey(key),
    nextBusinessDate: nextBusinessDay(key),
    saved: Boolean(saved),
    fromDealLog: merged.fromDealLog,
    unitsSource: merged.unitsSource,
    report,
    metrics: report.metrics,
    monthly: rollup.monthly,
    monthlyPrior: rollup.monthlyPrior,
    weekly: rollup.weekly,
    week: rollup.week,
    dealLog: {
      ...dealHint,
      lastRetailDate: dealHint.lastRetailDate || ''
    }
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
