/**
 * Pure reporting helpers shared by the API and tests.
 * These functions do not touch disk or Google Sheets.
 */

export const DEAL_WORKING = 'working';
export const DEAL_SOLD = 'sold';
export const DEAL_DELIVERED = 'delivered';
export const DEAL_DEAD = 'dead';
export const DEAL_STATUSES = [DEAL_WORKING, DEAL_SOLD, DEAL_DELIVERED, DEAL_DEAD];

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

export function formatLongDate(dateKey) {
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
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

export function isFleetType(value) {
  const type = String(value || '').trim().toUpperCase();
  return type === 'FLEET' || type === 'COMMERCIAL' || type === 'FLEET/COMMERCIAL';
}

export function classifyDept(value) {
  const dept = String(value || '').trim().toUpperCase();
  if (dept === 'NEW') {
    return 'new';
  }
  if (dept === 'USED') {
    return 'used';
  }
  if (dept === 'FLEET' || dept === 'COMMERCIAL') {
    return 'fleet';
  }
  return 'other';
}

export function isFleetDeal(deal = {}) {
  const type = deal.type || deal.TYPE || deal.saleType;
  const dept = deal.dept || deal.DEPT || deal.newUsed;
  return isFleetType(type) || classifyDept(dept) === 'fleet';
}

export function emptyFleetTotals() {
  return {
    soldDeals: 0,
    frontGross: 0,
    financeGross: 0,
    totalGross: 0,
    dealCount: 0,
    units: 0
  };
}

function addFleetSale(bucket, rec) {
  bucket.dealCount += 1;
  bucket.soldDeals += rec.units;
  bucket.units += rec.units;
  bucket.frontGross = roundMoney(bucket.frontGross + rec.front);
  bucket.financeGross = roundMoney(bucket.financeGross + rec.finance);
  bucket.totalGross = roundMoney(bucket.totalGross + rec.total);
}

export function summarizeFleetDealLog(deals = [], dateKey) {
  const key = dateKey ? toDateKey(dateKey) : null;
  const month = key ? monthKey(key) : null;
  const daily = emptyFleetTotals();
  const monthly = emptyFleetTotals();
  const rows = [];
  let lastFleetDate = '';

  for (const deal of deals) {
    if (!deal || !isFleetDeal(deal)) {
      continue;
    }
    const dealDate = parseSheetDateKey(deal.date || deal.DATE);
    if (!dealDate) {
      continue;
    }
    const front = roundMoney(deal.frontGross ?? deal.front ?? deal.fTotal ?? deal['F TOTAL']);
    const finance = roundMoney(deal.financeGross ?? deal.backGross ?? deal.back ?? deal.finTotal ?? deal['FIN TOTAL']);
    const total = roundMoney(deal.totalGross ?? deal.total ?? deal['TOTAL GROSS'] ?? front + finance);
    const units = Math.max(1, Math.round(toNumber(deal.unit ?? deal.UNIT ?? deal.units, 1)));
    const rec = {
      date: dealDate,
      dealNumber: deal.deal || deal.DEAL || deal.dealNumber || '',
      stock: deal.stock || deal.STOCK || '',
      type: String(deal.type || deal.TYPE || '').trim(),
      dept: classifyDept(deal.dept || deal.DEPT),
      front,
      finance,
      total,
      units,
      customer: deal.customer || deal.CUSTOMER || deal.account || ''
    };
    if (dealDate > lastFleetDate) {
      lastFleetDate = dealDate;
    }
    if (key && dealDate === key) {
      addFleetSale(daily, rec);
      rows.push(rec);
    }
    if (month && dealDate.startsWith(month)) {
      addFleetSale(monthly, rec);
    }
  }

  return { date: key, month, daily, monthly, rows, lastFleetDate };
}

export function grossPerUnit(amount, units) {
  const sold = toNumber(units);
  if (sold <= 0) {
    return null;
  }
  return roundMoney(toNumber(amount) / sold);
}

export function goalPace(actual, goal) {
  const target = toNumber(goal);
  if (target <= 0) {
    return null;
  }
  return toNumber(actual) / target;
}

export function normalizeDealStatus(value) {
  const status = String(value || DEAL_WORKING).trim().toLowerCase();
  return DEAL_STATUSES.includes(status) ? status : DEAL_WORKING;
}

export function dealUnits(deal = {}) {
  return Math.max(0, Math.round(toNumber(deal.units, 1)));
}

export function isOpenWorkingDeal(deal = {}) {
  const status = normalizeDealStatus(deal.status);
  return status === DEAL_WORKING || status === DEAL_SOLD;
}

export function nextWorkingDealId(existing = [], dateKey, now = new Date()) {
  const key = toDateKey(dateKey, now);
  const prefix = `FLM-${key.replace(/-/g, '')}-`;
  let maxSeq = 0;
  for (const item of existing) {
    const id = item && item.id ? String(item.id) : '';
    if (!id.startsWith(prefix)) {
      continue;
    }
    const seq = Number(id.slice(prefix.length));
    if (Number.isFinite(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function normalizeWorkingDeal(payload = {}, now = new Date()) {
  const openedDate = toDateKey(payload.openedDate || payload.date, now);
  const expectedDelivery = parseSheetDateKey(payload.expectedDelivery || payload.expectedDeliveryDate) || '';
  const units = Math.max(1, Math.round(toNumber(payload.units, 1)));
  const frontGross = roundMoney(payload.frontGross);
  const financeGross = roundMoney(payload.financeGross ?? payload.backGross);
  return {
    id: payload.id || '',
    openedDate,
    customer: String(payload.customer || '').trim(),
    account: String(payload.account || payload.company || '').trim(),
    stock: String(payload.stock || '').trim(),
    vehicle: String(payload.vehicle || '').trim(),
    units,
    frontGross,
    financeGross,
    totalGross: roundMoney(frontGross + financeGross),
    expectedDelivery,
    status: normalizeDealStatus(payload.status),
    notes: String(payload.notes || '').trim(),
    submittedBy: payload.submittedBy || 'Fleet Manager',
    updatedAt: payload.updatedAt || now.toISOString()
  };
}

export function workingDealSummary(deals = [], dateKey) {
  const key = toDateKey(dateKey);
  const month = monthKey(key);
  const open = deals.filter(isOpenWorkingDeal);
  const working = open.filter((row) => normalizeDealStatus(row.status) === DEAL_WORKING);
  const soldOpen = open.filter((row) => normalizeDealStatus(row.status) === DEAL_SOLD);
  const deliveredToday = deals.filter((row) => {
    return normalizeDealStatus(row.status) === DEAL_DELIVERED && (row.updatedAt || '').startsWith(key);
  });
  const openedToday = deals.filter((row) => row.openedDate === key);
  const expectedThisMonth = open.filter((row) => {
    const expected = parseSheetDateKey(row.expectedDelivery);
    return !expected || expected.startsWith(month);
  });
  const expectedToday = open.filter((row) => parseSheetDateKey(row.expectedDelivery) === key);
  const openUnits = open.reduce((sum, row) => sum + dealUnits(row), 0);
  const workingUnits = working.reduce((sum, row) => sum + dealUnits(row), 0);
  const expectedUnits = expectedThisMonth.reduce((sum, row) => sum + dealUnits(row), 0);
  const expectedTodayUnits = expectedToday.reduce((sum, row) => sum + dealUnits(row), 0);

  return {
    openCount: open.length,
    workingCount: working.length,
    soldOpenCount: soldOpen.length,
    openUnits,
    workingUnits,
    expectedUnits,
    expectedTodayUnits,
    openedTodayCount: openedToday.length,
    deliveredTodayCount: deliveredToday.length,
    open,
    working,
    soldOpen,
    expectedThisMonth,
    expectedToday
  };
}

export function emptyDailyCounts() {
  return {
    soldDeals: 0,
    workingDeals: 0,
    frontGross: 0,
    financeGross: 0,
    totalGross: 0,
    deliveries: 0,
    courtesyDeliveries: 0,
    expectedDeliveries: 0
  };
}

export function reportMetrics(report = {}, goal = {}) {
  const sold = toNumber(report.soldDeals);
  const totalGross = roundMoney(report.totalGross ?? toNumber(report.frontGross) + toNumber(report.financeGross));
  return {
    gpu: grossPerUnit(totalGross, sold),
    frontGpu: grossPerUnit(report.frontGross, sold),
    financeGpu: grossPerUnit(report.financeGross, sold),
    unitPace: goalPace(sold, goal.unitGoal),
    grossPace: goalPace(totalGross, goal.grossGoal)
  };
}

export function normalizeDailyReport(payload = {}, now = new Date()) {
  const date = toDateKey(payload.date, now);
  const soldDeals = Math.max(0, Math.round(toNumber(payload.soldDeals)));
  const workingDeals = Math.max(0, Math.round(toNumber(payload.workingDeals)));
  const frontGross = roundMoney(payload.frontGross);
  const financeGross = roundMoney(payload.financeGross ?? payload.backGross);
  const totalGross = roundMoney(frontGross + financeGross);
  const deliveries = Math.max(0, Math.round(toNumber(payload.deliveries)));
  const courtesyDeliveries = Math.max(0, Math.round(toNumber(payload.courtesyDeliveries)));
  const expectedDeliveries = Math.max(0, Math.round(toNumber(payload.expectedDeliveries)));
  const report = {
    date,
    month: monthKey(date),
    soldDeals,
    workingDeals,
    frontGross,
    financeGross,
    totalGross,
    deliveries,
    courtesyDeliveries,
    expectedDeliveries,
    notes: String(payload.notes || '').trim(),
    submittedBy: payload.submittedBy || 'Fleet Manager',
    submittedAt: payload.submittedAt || now.toISOString(),
    source: payload.source || 'manual'
  };
  return {
    ...report,
    metrics: reportMetrics(report)
  };
}

export function normalizeMonthlyGoal(payload = {}, now = new Date()) {
  const month = String(payload.month || monthKey(payload.date || now)).slice(0, 7);
  return {
    month,
    unitGoal: Math.max(0, Math.round(toNumber(payload.unitGoal ?? payload.units))),
    grossGoal: roundMoney(payload.grossGoal ?? payload.totalGross),
    notes: String(payload.notes || '').trim(),
    submittedBy: payload.submittedBy || 'Fleet Manager',
    submittedAt: payload.submittedAt || now.toISOString()
  };
}

export function findDailyReport(rows = [], dateKey) {
  const key = toDateKey(dateKey);
  const matches = rows.filter((row) => row.date === key);
  return matches.length ? matches[matches.length - 1] : null;
}

export function findMonthlyGoal(goals = [], dateKey) {
  const month = monthKey(dateKey);
  const matches = goals.filter((row) => row.month === month);
  return matches.length ? matches[matches.length - 1] : null;
}

export function sumReports(rows = []) {
  return rows.reduce(
    (acc, row) => {
      acc.soldDeals += toNumber(row.soldDeals);
      acc.workingDeals += toNumber(row.workingDeals);
      acc.frontGross = roundMoney(acc.frontGross + toNumber(row.frontGross));
      acc.financeGross = roundMoney(acc.financeGross + toNumber(row.financeGross));
      acc.totalGross = roundMoney(acc.totalGross + toNumber(row.totalGross));
      acc.deliveries += toNumber(row.deliveries);
      acc.courtesyDeliveries += toNumber(row.courtesyDeliveries);
      acc.expectedDeliveries += toNumber(row.expectedDeliveries);
      acc.entryCount += 1;
      return acc;
    },
    { ...emptyDailyCounts(), entryCount: 0 }
  );
}

export function overlayMonthToDate(prior = {}, today = {}, goal = {}) {
  const soldDeals = toNumber(prior.soldDeals) + toNumber(today.soldDeals);
  const frontGross = roundMoney(toNumber(prior.frontGross) + toNumber(today.frontGross));
  const financeGross = roundMoney(toNumber(prior.financeGross) + toNumber(today.financeGross));
  const todayGross = roundMoney(toNumber(today.totalGross, toNumber(today.frontGross) + toNumber(today.financeGross)));
  const priorGross = roundMoney(toNumber(prior.totalGross, toNumber(prior.frontGross) + toNumber(prior.financeGross)));
  const totals = {
    soldDeals,
    workingDeals: toNumber(today.workingDeals || prior.workingDeals),
    frontGross,
    financeGross,
    totalGross: roundMoney(priorGross + todayGross),
    deliveries: toNumber(prior.deliveries) + toNumber(today.deliveries),
    courtesyDeliveries: toNumber(prior.courtesyDeliveries) + toNumber(today.courtesyDeliveries),
    expectedDeliveries: toNumber(today.expectedDeliveries)
  };
  return { ...totals, metrics: reportMetrics(totals, goal) };
}

export function rollupReports(reports = [], dateKey, goal = {}) {
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
    monthly: { ...monthly, metrics: reportMetrics(monthly, goal) },
    monthlyPrior: { ...monthlyPrior, metrics: reportMetrics(monthlyPrior, goal) },
    weekly: { ...weekly, metrics: reportMetrics(weekly, goal) }
  };
}

export function applyFleetDealLog(base = {}, dealSummary = {}, dateKey, now = new Date(), options = {}) {
  const daily = dealSummary?.daily || emptyFleetTotals();
  const fromDealLog = toNumber(daily.dealCount) > 0;
  const saved = Boolean(options.saved);
  const report = normalizeDailyReport(
    {
      ...base,
      date: dateKey || base.date || dealSummary?.date,
      soldDeals: fromDealLog ? daily.soldDeals : base.soldDeals,
      frontGross: fromDealLog ? daily.frontGross : base.frontGross,
      financeGross: fromDealLog ? daily.financeGross : base.financeGross,
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

export function expectedDeliveriesFromPipeline(working = {}, savedExpected) {
  const fromPipeline = toNumber(working.expectedUnits);
  if (savedExpected != null && savedExpected !== '') {
    return Math.max(0, Math.round(toNumber(savedExpected)));
  }
  return fromPipeline;
}

export function buildDailySnapshot({
  dateKey,
  reports = [],
  workingDeals = [],
  goals = [],
  dealLog = [],
  now = new Date()
}) {
  const key = toDateKey(dateKey, now);
  const saved = findDailyReport(reports, key);
  const goal = findMonthlyGoal(goals, key) || normalizeMonthlyGoal({ month: monthKey(key), unitGoal: 0, grossGoal: 0 });
  const dealHint = summarizeFleetDealLog(dealLog, key);
  const working = workingDealSummary(workingDeals, key);
  const merged = applyFleetDealLog(
    saved || {
      date: key,
      workingDeals: working.openCount,
      expectedDeliveries: working.expectedUnits
    },
    dealHint,
    key,
    now,
    { saved: Boolean(saved) }
  );
  const report = merged.report;
  if (!saved) {
    report.submittedAt = '';
    report.submittedBy = '';
    report.workingDeals = working.openCount;
    report.expectedDeliveries = working.expectedUnits;
    if (!merged.fromDealLog) {
      report.source = 'unsaved';
    }
  } else if (report.workingDeals === 0 && working.openCount > 0) {
    report.workingDeals = working.openCount;
  }
  if (saved && (saved.expectedDeliveries == null || saved.expectedDeliveries === '')) {
    report.expectedDeliveries = working.expectedUnits;
  }
  report.metrics = reportMetrics(report, goal);
  const rollup = rollupReports(reports, key, goal);
  const liveMonth = overlayMonthToDate(rollup.monthlyPrior, report, goal);
  const totalExpected = expectedDeliveriesFromPipeline(working, report.expectedDeliveries);

  return {
    date: key,
    month: monthKey(key),
    nextBusinessDate: nextBusinessDay(key),
    saved: Boolean(saved),
    fromDealLog: merged.fromDealLog,
    unitsSource: merged.unitsSource,
    report,
    metrics: report.metrics,
    goal,
    monthly: liveMonth,
    monthlySaved: rollup.monthly,
    monthlyPrior: rollup.monthlyPrior,
    weekly: rollup.weekly,
    week: rollup.week,
    working,
    expectedDeliveries: {
      typed: report.expectedDeliveries,
      fromPipeline: working.expectedUnits,
      today: working.expectedTodayUnits,
      total: totalExpected
    },
    dealLog: {
      ...dealHint,
      lastFleetDate: dealHint.lastFleetDate || ''
    }
  };
}

export function reservedSheetNames() {
  return ['FLM_Dashboard', 'FLM_Daily', 'FLM_Working', 'FLM_Goals', 'FLM_Config'];
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
    'FLEET CUSTOMERS',
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
    'SMR_Config',
    'SLM_Dashboard',
    'SLM_Daily',
    'SLM_Config'
  ];
}

export function reservedFunctionPrefixes() {
  return ['FLM_'];
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
        message: `${name} is an FLM sheet. Install will reuse it and will not rename or delete it.`
      });
    }
  }

  for (const name of functionNames) {
    if (reservedSimpleTriggers().includes(name)) {
      collisions.push({
        type: 'trigger',
        name,
        severity: 'keep',
        message: `Existing ${name} will be left untouched. Call FLM_onOpen() from your current onOpen if you want the menu.`
      });
    }
    if (name.startsWith('FLM_')) {
      collisions.push({
        type: 'function',
        name,
        severity: 'info',
        message: `${name} is part of the Fleet Manager Report namespace.`
      });
    }
  }

  const existingNonFlmSheets = sheetNames.filter((name) => !name.startsWith('FLM_'));
  const protectedHits = sheetNames.filter((name) => geauxProtectedSheetNames().includes(name));
  protectedHits.forEach((name) => {
    collisions.push({
      type: 'protected-sheet',
      name,
      severity: 'keep',
      message: `${name} is an existing Geaux Chevrolet tab. FLM will not write, rename, hide, or delete it.`
    });
  });

  return {
    reservedSheets,
    existingNonFlmSheets,
    protectedHits,
    collisions,
    safeToInstall: collisions.every((item) => item.severity !== 'block'),
    notes: [
      'FLM never defines onOpen, onEdit, doGet, or doPost in the bound workbook package.',
      'FLM never deletes, hides, or renames existing non-FLM sheets.',
      'FLM writes only to FLM_* tabs and ScriptProperties keys prefixed with FLM_.',
      'Fleet deals can be read from DEALINPUT when TYPE or DEPT is Fleet. FLEET CUSTOMERS is read-only.',
      'Service SMR_* and sales SLM_* tabs stay untouched so all three briefings can share the file.'
    ]
  };
}
