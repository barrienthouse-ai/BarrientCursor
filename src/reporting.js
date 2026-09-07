/**
 * Pure reporting helpers shared by the API and tests.
 * These functions do not touch disk or Google Sheets.
 */

export const ITEM_OPEN = 'open';
export const ITEM_STOCKED = 'stocked';
export const ITEM_RECEIVED = 'received';
export const ITEM_INSTALLED = 'installed';
export const ITEM_RETURNED = 'returned';
export const ITEM_CLOSED = 'closed';

export const SOP_REC = 'rec';
export const SOP_INSTALLED = 'installed';
export const SOP_RETURNED = 'returned';

export const CORE_OUTSTANDING = 'outstanding';
export const CORE_RETURNED = 'returned';

export const BACKORDER_OPEN = 'open';
export const BACKORDER_RECEIVED = 'received';
export const BACKORDER_CLOSED = 'closed';

export const LOST_OPEN = 'open';
export const LOST_STOCKED = 'stocked';
export const LOST_CLOSED = 'closed';

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];

export const CDK_CODES = {
  inventory: { code: 'MGR → INV', name: 'Inventory Valuation', lookFor: 'Total inventory investment vs open parts payables.' },
  stockStatus: { code: 'RSM / RST', name: 'Stock Status Summary / Details', lookFor: 'No-Three-Month (N3M) and No-Six-Month (N6M) by source.' },
  sop: { code: 'SOP → RO', name: 'Special Order Parts on Open ROs', lookFor: 'REC status parts sitting while the vehicle is not in the shop.' },
  lostSales: { code: 'LSL', name: 'Lost Sales Log', lookFor: 'Part numbers looked up but not sold because they were out of stock.' },
  receipts: { code: 'IRE', name: 'Inventory Receipt Edit', lookFor: 'Share of receipts ordered through GM RIM vs factory compliance target.' },
  orders: { code: 'ORD', name: 'Parts Order Inquiry', lookFor: 'Emergency / CSO volume and premium freight.' },
  cores: { code: 'CRA', name: 'Core Return Authorization', lookFor: 'Outstanding core dollars not yet credited by GM.' }
};

export const THRESHOLDS = {
  waitWarnMinutes: 5,
  waitCritMinutes: 7,
  sopWarnDays: 7,
  sopCritDays: 14,
  obsolescenceWarnShare: 0.08,
  obsolescenceCritShare: 0.12,
  overstockWarnShare: 0.1,
  rimDefaultTarget: 90,
  capitalDefaultLimit: 500000
};

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

export function daysBetween(startKey, endKey) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
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

export function roundHours(value) {
  return Math.round(toNumber(value) * 10) / 10;
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
  return `${sign}$${Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function share(part, whole) {
  const denom = toNumber(whole);
  if (denom <= 0) {
    return null;
  }
  return toNumber(part) / denom;
}

export function normalizeSeverity(value) {
  const severity = String(value || 'medium').trim().toLowerCase();
  return SEVERITIES.includes(severity) ? severity : 'medium';
}

export function emptyDailyNumbers() {
  return {
    inventoryValue: 0,
    capitalLimit: THRESHOLDS.capitalDefaultLimit,
    n3mValue: 0,
    n6mValue: 0,
    overstockValue: 0,
    payablesOpen: 0,
    retailSales: 0,
    wholesaleSales: 0,
    internalSales: 0,
    counterWaitMinutes: 0,
    lostSalesCount: 0,
    lostSalesDollars: 0,
    sopReceivedCount: 0,
    sopAgedCount: 0,
    sopAgedValue: 0,
    rimCompliancePercent: 0,
    rimTargetPercent: THRESHOLDS.rimDefaultTarget,
    emergencyOrderCount: 0,
    emergencyFreightCost: 0,
    outstandingCoresValue: 0,
    wholesaleStops: 0,
    hotshotRuns: 0,
    deliveryFuelCost: 0,
    notes: ''
  };
}

export function normalizeDailyReport(payload = {}, now = new Date()) {
  const date = toDateKey(payload.date, now);
  const numbers = emptyDailyNumbers();
  for (const key of Object.keys(numbers)) {
    if (key === 'notes') {
      numbers.notes = String(payload.notes || '').trim();
      continue;
    }
    if (payload[key] === '' || payload[key] == null) {
      continue;
    }
    numbers[key] = key.includes('Count') || key.includes('Stops') || key.includes('Runs') || key === 'counterWaitMinutes'
      ? toNumber(payload[key])
      : roundMoney(payload[key]);
  }
  if (payload.capitalLimit == null || payload.capitalLimit === '') {
    numbers.capitalLimit = THRESHOLDS.capitalDefaultLimit;
  }
  if (payload.rimTargetPercent == null || payload.rimTargetPercent === '') {
    numbers.rimTargetPercent = THRESHOLDS.rimDefaultTarget;
  }
  return {
    id: payload.id || '',
    date,
    month: monthKey(date),
    ...numbers,
    submittedBy: payload.submittedBy || 'Parts Manager',
    submittedAt: payload.submittedAt || now.toISOString(),
    source: payload.source || 'manual'
  };
}

export function capitalHealth(entry = {}) {
  const inventoryValue = roundMoney(entry.inventoryValue);
  const capitalLimit = roundMoney(entry.capitalLimit || THRESHOLDS.capitalDefaultLimit);
  const n3mValue = roundMoney(entry.n3mValue);
  const n6mValue = roundMoney(entry.n6mValue);
  const overstockValue = roundMoney(entry.overstockValue);
  const payablesOpen = roundMoney(entry.payablesOpen);
  const utilization = share(inventoryValue, capitalLimit);
  return {
    inventoryValue,
    capitalLimit,
    variance: roundMoney(inventoryValue - capitalLimit),
    utilization,
    overCapital: inventoryValue > capitalLimit,
    n3mValue,
    n6mValue,
    overstockValue,
    payablesOpen,
    n3mShare: share(n3mValue, inventoryValue),
    n6mShare: share(n6mValue, inventoryValue),
    overstockShare: share(overstockValue, inventoryValue)
  };
}

export function salesTotals(entry = {}) {
  const retailSales = roundMoney(entry.retailSales);
  const wholesaleSales = roundMoney(entry.wholesaleSales);
  const internalSales = roundMoney(entry.internalSales);
  return {
    retailSales,
    wholesaleSales,
    internalSales,
    totalSales: roundMoney(retailSales + wholesaleSales + internalSales)
  };
}

export function waitStatus(minutes) {
  const wait = toNumber(minutes);
  if (wait > THRESHOLDS.waitCritMinutes) {
    return 'crit';
  }
  if (wait > THRESHOLDS.waitWarnMinutes) {
    return 'warn';
  }
  return 'ok';
}

export function rimStatus(compliancePercent, targetPercent = THRESHOLDS.rimDefaultTarget) {
  const actual = toNumber(compliancePercent);
  const target = toNumber(targetPercent, THRESHOLDS.rimDefaultTarget);
  const gap = roundHours(target - actual);
  return {
    actual,
    target,
    gap,
    onTarget: actual >= target
  };
}

export function sopAgeStatus(ageDays) {
  const age = toNumber(ageDays);
  if (age >= THRESHOLDS.sopCritDays) {
    return 'crit';
  }
  if (age >= THRESHOLDS.sopWarnDays) {
    return 'warn';
  }
  return 'ok';
}

export function nextItemId(prefix, existing = [], dateKey, now = new Date()) {
  const key = toDateKey(dateKey, now).replace(/-/g, '');
  const fullPrefix = `${prefix}-${key}-`;
  let maxSeq = 0;
  for (const item of existing) {
    const id = item && item.id ? String(item.id) : '';
    if (!id.startsWith(fullPrefix)) {
      continue;
    }
    const seq = Number(id.slice(fullPrefix.length));
    if (Number.isFinite(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  return `${fullPrefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function normalizeLostStatus(value) {
  const status = String(value || LOST_OPEN).trim().toLowerCase();
  if (status === LOST_STOCKED || status === LOST_CLOSED || status === LOST_OPEN) {
    return status;
  }
  return LOST_OPEN;
}

export function normalizeSopStatus(value) {
  const status = String(value || SOP_REC).trim().toLowerCase();
  if (status === 'received') {
    return SOP_REC;
  }
  if (status === SOP_INSTALLED || status === SOP_RETURNED || status === SOP_REC) {
    return status;
  }
  return SOP_REC;
}

export function normalizeBackorderStatus(value) {
  const status = String(value || BACKORDER_OPEN).trim().toLowerCase();
  if (status === BACKORDER_RECEIVED || status === BACKORDER_CLOSED || status === BACKORDER_OPEN) {
    return status;
  }
  return BACKORDER_OPEN;
}

export function normalizeCoreStatus(value) {
  const status = String(value || CORE_OUTSTANDING).trim().toLowerCase();
  if (status === CORE_RETURNED || status === CORE_OUTSTANDING) {
    return status;
  }
  return CORE_OUTSTANDING;
}

export function applyBoardAction(row, action, timestamp, notes = '') {
  const next = { ...row, updatedAt: timestamp };
  if (action === 'stock' || action === 'stocked') {
    next.status = LOST_STOCKED;
    next.closedAt = next.closedAt || timestamp;
    return next;
  }
  if (action === 'install' || action === 'installed') {
    next.status = SOP_INSTALLED;
    next.closedAt = timestamp;
    return next;
  }
  if (action === 'receive' || action === 'received') {
    next.status = BACKORDER_RECEIVED;
    next.receivedAt = next.receivedAt || timestamp;
    return next;
  }
  if (action === 'return' || action === 'returned') {
    next.status = row.kind === 'core' ? CORE_RETURNED : SOP_RETURNED;
    next.closedAt = timestamp;
    next.resolutionNotes = notes || next.resolutionNotes || '';
    return next;
  }
  if (action === 'close' || action === 'closed') {
    next.status = ITEM_CLOSED;
    next.closedAt = timestamp;
    next.resolutionNotes = notes || next.resolutionNotes || '';
    return next;
  }
  if (action === 'reopen') {
    next.status = row.kind === 'core' ? CORE_OUTSTANDING : (row.kind === 'sop' ? SOP_REC : ITEM_OPEN);
    next.closedAt = '';
    next.receivedAt = row.kind === 'backorder' ? '' : next.receivedAt;
    return next;
  }
  throw new Error(`Unknown board action: ${action}`);
}

export function lostSalesSummary(rows = [], dateKey) {
  const key = toDateKey(dateKey);
  const weekStart = addDays(key, -6);
  const open = rows.filter((row) => normalizeLostStatus(row.status) === LOST_OPEN);
  const today = rows.filter((row) => row.openedDate === key || row.date === key);
  const week = rows.filter((row) => {
    const day = row.openedDate || row.date;
    return day >= weekStart && day <= key;
  });
  const repeats = [];
  const byPart = new Map();
  for (const row of week) {
    const part = String(row.partNumber || '').trim().toUpperCase();
    if (!part) {
      continue;
    }
    const current = byPart.get(part) || { partNumber: part, description: row.description || '', hits: 0, dollars: 0 };
    current.hits += Math.max(1, toNumber(row.timesRequested || 1));
    current.dollars = roundMoney(current.dollars + toNumber(row.dollars));
    current.description = current.description || row.description || '';
    byPart.set(part, current);
  }
  for (const item of byPart.values()) {
    if (item.hits >= 2) {
      repeats.push(item);
    }
  }
  repeats.sort((a, b) => b.hits - a.hits);
  return {
    openCount: open.length,
    todayCount: today.length,
    weekCount: week.length,
    openDollars: roundMoney(open.reduce((sum, row) => sum + toNumber(row.dollars), 0)),
    repeats,
    open
  };
}

export function sopSummary(rows = [], dateKey) {
  const key = toDateKey(dateKey);
  const rec = rows.filter((row) => normalizeSopStatus(row.status) === SOP_REC);
  const aged = rec.filter((row) => toNumber(row.ageDays) >= THRESHOLDS.sopCritDays || daysBetween(row.receivedDate || row.openedDate, key) >= THRESHOLDS.sopCritDays);
  const bottleneck = rec.filter((row) => {
    const age = toNumber(row.ageDays) || daysBetween(row.receivedDate || row.openedDate, key);
    return age >= THRESHOLDS.sopWarnDays;
  });
  const recValue = roundMoney(rec.reduce((sum, row) => sum + toNumber(row.dollars), 0));
  const agedValue = roundMoney(aged.reduce((sum, row) => sum + toNumber(row.dollars), 0));
  return {
    recCount: rec.length,
    agedCount: aged.length,
    bottleneckCount: bottleneck.length,
    recValue,
    agedValue,
    rec,
    aged
  };
}

export function backorderSummary(rows = []) {
  const open = rows.filter((row) => normalizeBackorderStatus(row.status) !== BACKORDER_CLOSED);
  const critical = open.filter((row) => normalizeSeverity(row.severity) === 'critical' || String(row.reason || '').toLowerCase().includes('stop'));
  return {
    openCount: open.length,
    criticalCount: critical.length,
    open,
    critical
  };
}

export function coreSummary(rows = [], dateKey) {
  const key = toDateKey(dateKey);
  const outstanding = rows.filter((row) => normalizeCoreStatus(row.status) === CORE_OUTSTANDING);
  const dollars = roundMoney(outstanding.reduce((sum, row) => sum + toNumber(row.dollars), 0));
  const aged = outstanding.filter((row) => {
    const age = toNumber(row.daysOutstanding) || daysBetween(row.openedDate, key);
    return age >= 14;
  });
  return {
    openCount: outstanding.length,
    dollars,
    agedCount: aged.length,
    outstanding,
    aged
  };
}

export function withSopAge(row, dateKey) {
  const key = toDateKey(dateKey);
  const received = row.receivedDate || row.openedDate;
  const ageDays = received ? Math.max(0, daysBetween(received, key)) : toNumber(row.ageDays);
  return { ...row, ageDays, ageStatus: sopAgeStatus(ageDays) };
}

export function buildAlerts({ report = {}, capital = {}, sales = {}, wait = 'ok', rim = {}, lost = {}, sop = {}, backorders = {}, cores = {} } = {}) {
  const alerts = [];
  if (capital.overCapital) {
    alerts.push({
      level: 'crit',
      area: 'inventory',
      title: 'Inventory over capital limit',
      detail: `${formatMoney(capital.inventoryValue)} on hand vs ${formatMoney(capital.capitalLimit)} monthly limit (${formatMoney(capital.variance)} over). CDK ${CDK_CODES.inventory.code}.`
    });
  } else if (capital.utilization != null && capital.utilization >= 0.95) {
    alerts.push({
      level: 'warn',
      area: 'inventory',
      title: 'Inventory near capital limit',
      detail: `${formatPercent(capital.utilization)} of the monthly parts capital is in stock.`
    });
  }
  if (capital.n6mShare != null && capital.n6mShare >= THRESHOLDS.obsolescenceCritShare) {
    alerts.push({
      level: 'crit',
      area: 'obsolescence',
      title: '90+ day obsolescence is building',
      detail: `${formatMoney(capital.n6mValue)} N6M / no-movement (${formatPercent(capital.n6mShare)} of inventory). CDK ${CDK_CODES.stockStatus.code}.`
    });
  } else if (capital.n6mShare != null && capital.n6mShare >= THRESHOLDS.obsolescenceWarnShare) {
    alerts.push({
      level: 'warn',
      area: 'obsolescence',
      title: 'Watch N3M / N6M dead stock',
      detail: `${formatMoney(capital.n3mValue)} N3M and ${formatMoney(capital.n6mValue)} N6M with zero movement.`
    });
  }
  if (capital.overstockShare != null && capital.overstockShare >= THRESHOLDS.overstockWarnShare) {
    alerts.push({
      level: 'warn',
      area: 'overstock',
      title: 'Pad / overstock for OEM loyalty',
      detail: `${formatMoney(capital.overstockValue)} looks like pad stock for GM RIM/PDI rather than shop demand.`
    });
  }
  if (wait === 'crit') {
    alerts.push({
      level: 'crit',
      area: 'counter',
      title: 'Technician counter wait over 7 minutes',
      detail: `${toNumber(report.counterWaitMinutes)} minutes at the parts counter is cutting shop efficiency.`
    });
  } else if (wait === 'warn') {
    alerts.push({
      level: 'warn',
      area: 'counter',
      title: 'Technician counter wait over 5 minutes',
      detail: `${toNumber(report.counterWaitMinutes)} minutes. Target is 5 minutes or less.`
    });
  }
  if (lost.repeats && lost.repeats.length) {
    const top = lost.repeats[0];
    alerts.push({
      level: 'warn',
      area: 'lost-sales',
      title: 'Repeat lost sales — override the matrix',
      detail: `${top.partNumber} hit the lost sales log ${top.hits} times this week. CDK ${CDK_CODES.lostSales.code}.`
    });
  }
  if (sop.agedCount > 0) {
    alerts.push({
      level: 'crit',
      area: 'sop',
      title: 'Special orders sitting past 14 days',
      detail: `${sop.agedCount} REC parts / ${formatMoney(sop.agedValue)} risk becoming non-returnable dead stock. CDK ${CDK_CODES.sop.code}.`
    });
  } else if (sop.bottleneckCount > 0) {
    alerts.push({
      level: 'warn',
      area: 'sop',
      title: 'SOP received but not installed',
      detail: `${sop.bottleneckCount} customer orders have been in REC 7+ days.`
    });
  }
  if (rim && rim.onTarget === false) {
    alerts.push({
      level: 'warn',
      area: 'rim',
      title: 'GM RIM below target',
      detail: `${rim.actual}% compliance vs ${rim.target}% target (${rim.gap} pts short). Return privileges and discounts are at risk. CDK ${CDK_CODES.receipts.code}.`
    });
  }
  if (toNumber(report.emergencyOrderCount) >= 5 || toNumber(report.emergencyFreightCost) >= 250) {
    alerts.push({
      level: 'warn',
      area: 'orders',
      title: 'High emergency / CSO freight',
      detail: `${toNumber(report.emergencyOrderCount)} emergency/CSO orders and ${formatMoney(report.emergencyFreightCost)} premium freight. CDK ${CDK_CODES.orders.code}.`
    });
  }
  if (backorders.criticalCount > 0) {
    alerts.push({
      level: 'crit',
      area: 'backorder',
      title: 'Critical backorders holding vehicles',
      detail: `${backorders.criticalCount} stop-sale or bay-blocking parts are still on backorder.`
    });
  }
  if (toNumber(cores.dollars) >= 1500 || cores.agedCount > 0) {
    alerts.push({
      level: cores.agedCount > 0 ? 'crit' : 'warn',
      area: 'cores',
      title: 'Outstanding cores are uncollected cash',
      detail: `${formatMoney(cores.dollars)} sitting in the shop or on a truck. CDK ${CDK_CODES.cores.code}.`
    });
  }
  const critCount = alerts.filter((item) => item.level === 'crit').length;
  const warnCount = alerts.filter((item) => item.level === 'warn').length;
  return {
    alerts,
    critCount,
    warnCount,
    ok: alerts.length === 0
  };
}

export function rollupMonth(reports = [], dateKey) {
  const key = toDateKey(dateKey);
  const month = monthKey(key);
  const monthRows = reports.filter((row) => typeof row.date === 'string' && row.date.startsWith(month) && row.date <= key);
  const totals = emptyDailyNumbers();
  totals.notes = '';
  for (const row of monthRows) {
    totals.retailSales += toNumber(row.retailSales);
    totals.wholesaleSales += toNumber(row.wholesaleSales);
    totals.internalSales += toNumber(row.internalSales);
    totals.lostSalesCount += toNumber(row.lostSalesCount);
    totals.lostSalesDollars += toNumber(row.lostSalesDollars);
    totals.emergencyOrderCount += toNumber(row.emergencyOrderCount);
    totals.emergencyFreightCost += toNumber(row.emergencyFreightCost);
    totals.wholesaleStops += toNumber(row.wholesaleStops);
    totals.hotshotRuns += toNumber(row.hotshotRuns);
    totals.deliveryFuelCost += toNumber(row.deliveryFuelCost);
  }
  const latest = monthRows.length ? monthRows[monthRows.length - 1] : null;
  return {
    month,
    daysReported: monthRows.length,
    sales: salesTotals(totals),
    lostSalesCount: totals.lostSalesCount,
    lostSalesDollars: roundMoney(totals.lostSalesDollars),
    emergencyOrderCount: totals.emergencyOrderCount,
    emergencyFreightCost: roundMoney(totals.emergencyFreightCost),
    wholesaleStops: totals.wholesaleStops,
    hotshotRuns: totals.hotshotRuns,
    deliveryFuelCost: roundMoney(totals.deliveryFuelCost),
    latest
  };
}

export function findDaily(rows = [], dateKey) {
  const key = toDateKey(dateKey);
  const matches = rows.filter((row) => row.date === key);
  return matches.length ? matches[matches.length - 1] : null;
}

export function buildDailySnapshot({
  dateKey,
  reports = [],
  lostSales = [],
  sopItems = [],
  backorders = [],
  cores = [],
  config = {}
} = {}) {
  const key = toDateKey(dateKey);
  const saved = findDaily(reports, key);
  const report = normalizeDailyReport({
    ...(saved || {}),
    date: key,
    capitalLimit: saved?.capitalLimit ?? config.capitalLimit ?? THRESHOLDS.capitalDefaultLimit,
    rimTargetPercent: saved?.rimTargetPercent ?? config.rimTargetPercent ?? THRESHOLDS.rimDefaultTarget
  });
  const capital = capitalHealth(report);
  const sales = salesTotals(report);
  const wait = waitStatus(report.counterWaitMinutes);
  const rim = rimStatus(report.rimCompliancePercent, report.rimTargetPercent);
  const lost = lostSalesSummary(lostSales, key);
  const sop = sopSummary(sopItems.map((row) => withSopAge(row, key)), key);
  const backorder = backorderSummary(backorders);
  const core = coreSummary(cores, key);
  const month = rollupMonth(reports, key);
  const flags = buildAlerts({ report, capital, sales, wait, rim, lost, sop, backorders: backorder, cores: core });
  return {
    date: key,
    month: monthKey(key),
    reported: Boolean(saved),
    report,
    capital,
    sales,
    wait,
    rim,
    lostSales: lost,
    sop,
    backorders: backorder,
    cores: core,
    month,
    flags,
    cdk: CDK_CODES
  };
}

export function reservedSheetNames() {
  return [
    'PMR_Dashboard',
    'PMR_Daily',
    'PMR_LostSales',
    'PMR_Sop',
    'PMR_Backorders',
    'PMR_Cores',
    'PMR_Config'
  ];
}

export function geauxProtectedSheetNames() {
  return [
    'HOME',
    'SUMMARY',
    'DEALINPUT',
    'SERVICE BOARD',
    'SVC_RO',
    'SVC_RO_LINES',
    'SVC_PARTS_REQUESTS',
    'PARTS_ITEMS',
    'PARTS_TICKETS',
    'PARTS_TICKET_LINES',
    'ADMIN_EMPLOYEES',
    'EMAIL_QUEUE',
    'QUOTE_STORE',
    'DO NOT DELETE - AutoCrat Job Se',
    'SLM_Dashboard',
    'SLM_Daily',
    'SLM_Config',
    'SMR_Dashboard',
    'SMR_TechHours',
    'SMR_Gross',
    'SMR_HeatCases',
    'SMR_RepairOrders',
    'SMR_Roster',
    'SMR_Config',
    'FLM_Dashboard',
    'FLM_Daily',
    'FLM_Working',
    'FLM_Goals',
    'FLM_Config'
  ];
}

export function reservedFunctionPrefixes() {
  return ['PMR_'];
}

export function reservedSimpleTriggers() {
  return ['onOpen', 'onEdit', 'onInstall', 'onSelectionChange', 'onChange', 'doGet', 'doPost'];
}

export function auditWorkbook({ sheetNames = [], functionNames = [] } = {}) {
  const reservedSheets = reservedSheetNames();
  const collisions = [];

  for (const name of sheetNames) {
    if (reservedSheets.includes(name)) {
      collisions.push({
        type: 'sheet',
        name,
        severity: 'info',
        message: `${name} is a PMR sheet. Install will reuse it and will not rename or delete it.`
      });
    }
  }

  for (const name of functionNames) {
    if (reservedSimpleTriggers().includes(name)) {
      collisions.push({
        type: 'trigger',
        name,
        severity: 'keep',
        message: `Existing ${name} will be left untouched. Call PMR_onOpen() from your current onOpen if you want the menu.`
      });
    }
    if (name.startsWith('PMR_')) {
      collisions.push({
        type: 'function',
        name,
        severity: 'info',
        message: `${name} is part of the Parts Manager Report namespace.`
      });
    }
  }

  const existingNonPmrSheets = sheetNames.filter((name) => !name.startsWith('PMR_'));
  const protectedHits = sheetNames.filter((name) => geauxProtectedSheetNames().includes(name));
  protectedHits.forEach((name) => {
    collisions.push({
      type: 'protected-sheet',
      name,
      severity: 'keep',
      message: `${name} is an existing Geaux Chevrolet tab. PMR will not write, rename, hide, or delete it.`
    });
  });
  return {
    reservedSheets,
    existingNonPmrSheets,
    protectedHits,
    collisions,
    safeToInstall: collisions.every((item) => item.severity !== 'block'),
    notes: [
      'PMR never defines onOpen, onEdit, doGet, or doPost.',
      'PMR never deletes, hides, or renames existing non-PMR sheets.',
      'PMR writes only to PMR_* tabs and ScriptProperties keys prefixed with PMR_.'
    ]
  };
}
