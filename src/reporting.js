/**
 * Pure reporting helpers shared by the API and tests.
 * These functions do not touch disk or Google Sheets.
 */

export const PERIOD_DAILY = 'daily';
export const PERIOD_MONTHLY = 'monthly';

export const HEAT_OPEN = 'open';
export const HEAT_BRIEFED = 'briefed';
export const HEAT_RESOLVED = 'resolved';

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];

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
  const key = toDateKey(dateKey);
  return key.slice(0, 7);
}

export function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[$,%\s]/g, ''));
  return Number.isFinite(num) ? num : fallback;
}

export function computeEfficiency(soldHours, clockHours) {
  const sold = toNumber(soldHours);
  const clock = toNumber(clockHours);
  if (clock <= 0) {
    return null;
  }
  return sold / clock;
}

export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) {
    return '—';
  }
  return `${(ratio * 100).toFixed(1)}%`;
}

export function sumTechHours(rows = []) {
  return rows.reduce(
    (acc, row) => {
      acc.clockHours += toNumber(row.clockHours);
      acc.soldHours += toNumber(row.soldHours);
      acc.lineCount += 1;
      return acc;
    },
    { clockHours: 0, soldHours: 0, lineCount: 0 }
  );
}

export function totalGrossAmount(entry) {
  if (!entry) {
    return 0;
  }
  return toNumber(entry.laborGross) + toNumber(entry.otherGross);
}

export function mergeHoursWithRoster(savedRows = [], roster = []) {
  const byName = new Map();
  for (const row of savedRows) {
    const key = String(row.techName || '').trim().toUpperCase();
    if (key) {
      byName.set(key, row);
    }
  }
  const used = new Set();
  const merged = roster.filter(Boolean).map((name) => {
    const key = String(name).trim().toUpperCase();
    used.add(key);
    const existing = byName.get(key);
    return {
      techName: name,
      clockHours: existing ? existing.clockHours : 8,
      soldHours: existing ? existing.soldHours : '',
      notes: existing ? existing.notes || '' : ''
    };
  });
  for (const row of savedRows) {
    const key = String(row.techName || '').trim().toUpperCase();
    if (key && !used.has(key)) {
      merged.push(row);
    }
  }
  return merged;
}

export function sumGross(rows = []) {
  return rows.reduce(
    (acc, row) => {
      acc.laborGross += toNumber(row.laborGross);
      acc.partsGross += toNumber(row.partsGross);
      acc.otherGross += toNumber(row.otherGross);
      acc.totalGross += totalGrossAmount(row);
      acc.entryCount += 1;
      return acc;
    },
    { laborGross: 0, partsGross: 0, otherGross: 0, totalGross: 0, entryCount: 0 }
  );
}

export function filterByDate(rows = [], dateKey) {
  const key = toDateKey(dateKey);
  return rows.filter((row) => row.date === key);
}

export function filterByMonth(rows = [], month) {
  const prefix = month.length === 7 ? month : monthKey(month);
  return rows.filter((row) => typeof row.date === 'string' && row.date.startsWith(prefix));
}

export function rollupGross(entries = [], dateKey) {
  const key = toDateKey(dateKey);
  const month = monthKey(key);
  const dailyForDay = entries.filter((row) => row.period === PERIOD_DAILY && row.date === key);
  const dailyForMonth = entries.filter((row) => row.period === PERIOD_DAILY && row.date.startsWith(month));
  const monthlyOverride = entries.find(
    (row) => row.period === PERIOD_MONTHLY && (row.month === month || row.date === month || (row.date && row.date.startsWith(month)))
  );

  const daily = sumGross(dailyForDay);
  const monthFromDailies = sumGross(dailyForMonth);
  const monthly = monthlyOverride
    ? {
        ...sumGross([monthlyOverride]),
        source: 'override',
        override: monthlyOverride
      }
    : {
        ...monthFromDailies,
        source: 'daily-sum',
        override: null
      };

  return {
    date: key,
    month,
    daily,
    monthly,
    monthFromDailies
  };
}

export function nextHeatCaseId(existing = [], dateKey, now = new Date()) {
  const key = toDateKey(dateKey, now);
  const prefix = `HEAT-${key.replace(/-/g, '')}-`;
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

export function normalizeSeverity(value) {
  const severity = String(value || 'medium').trim().toLowerCase();
  return SEVERITIES.includes(severity) ? severity : 'medium';
}

export function normalizeHeatStatus(value) {
  const status = String(value || HEAT_OPEN).trim().toLowerCase();
  if (status === HEAT_BRIEFED || status === HEAT_RESOLVED || status === HEAT_OPEN) {
    return status;
  }
  return HEAT_OPEN;
}

export function applyHeatTransition(caseRow, action, timestamp, notes = '') {
  const next = { ...caseRow, updatedAt: timestamp };
  if (action === 'brief') {
    if (next.status === HEAT_RESOLVED) {
      throw new Error('Resolved heat cases cannot be marked briefed.');
    }
    next.status = HEAT_BRIEFED;
    next.briefedAt = next.briefedAt || timestamp;
    return next;
  }
  if (action === 'resolve') {
    next.status = HEAT_RESOLVED;
    next.briefedAt = next.briefedAt || timestamp;
    next.resolvedAt = timestamp;
    next.resolutionNotes = notes || next.resolutionNotes || '';
    return next;
  }
  if (action === 'reopen') {
    next.status = HEAT_OPEN;
    next.resolvedAt = '';
    return next;
  }
  throw new Error(`Unknown heat case action: ${action}`);
}

export function heatCaseSummary(cases = [], dateKey) {
  const key = toDateKey(dateKey);
  const open = cases.filter((row) => normalizeHeatStatus(row.status) !== HEAT_RESOLVED);
  const briefed = open.filter((row) => normalizeHeatStatus(row.status) === HEAT_BRIEFED);
  const critical = open.filter((row) => normalizeSeverity(row.severity) === 'critical');
  const high = open.filter((row) => normalizeSeverity(row.severity) === 'high');
  const resolvedToday = cases.filter((row) => {
    if (normalizeHeatStatus(row.status) !== HEAT_RESOLVED || !row.resolvedAt) {
      return false;
    }
    return String(row.resolvedAt).startsWith(key);
  });
  const openedToday = cases.filter((row) => row.openedDate === key);
  return {
    openCount: open.length,
    briefedCount: briefed.length,
    awaitingBriefing: open.length - briefed.length,
    criticalCount: critical.length,
    highCount: high.length,
    resolvedTodayCount: resolvedToday.length,
    openedTodayCount: openedToday.length,
    open,
    resolvedToday
  };
}

export function findDailyRo(rows = [], dateKey) {
  const matches = filterByDate(rows, dateKey);
  return matches.length ? matches[matches.length - 1] : null;
}

export function buildDailySnapshot({ dateKey, techHours = [], grossEntries = [], repairOrders = [], heatCases = [], roster = [] }) {
  const key = toDateKey(dateKey);
  const hoursRows = filterByDate(techHours, key);
  const hours = sumTechHours(hoursRows);
  const gross = rollupGross(grossEntries, key);
  const ro = findDailyRo(repairOrders, key);
  const heat = heatCaseSummary(heatCases, key);

  return {
    date: key,
    month: monthKey(key),
    techHours: {
      rows: hoursRows,
      formRows: mergeHoursWithRoster(hoursRows, roster),
      clockHours: hours.clockHours,
      soldHours: hours.soldHours,
      lineCount: hours.lineCount,
      efficiency: computeEfficiency(hours.soldHours, hours.clockHours)
    },
    gross,
    repairOrders: {
      openCount: ro ? toNumber(ro.openCount) : 0,
      closedCount: ro ? toNumber(ro.closedCount) : 0,
      writtenCount: ro ? toNumber(ro.writtenCount) : 0,
      reported: Boolean(ro),
      row: ro
    },
    heatCases: heat
  };
}

export function reservedSheetNames() {
  return [
    'SMR_Dashboard',
    'SMR_TechHours',
    'SMR_Gross',
    'SMR_HeatCases',
    'SMR_RepairOrders',
    'SMR_Roster',
    'SMR_Config'
  ];
}

export function geauxProtectedSheetNames() {
  return [
    'HOME',
    'SUMMARY',
    'SERVICE BOARD',
    'SVC_RO',
    'SVC_RO_LINES',
    'SVC_PARTS_REQUESTS',
    'ADMIN_EMPLOYEES',
    'EMAIL_QUEUE',
    'QUOTE_STORE',
    'DO NOT DELETE - AutoCrat Job Se'
  ];
}

export function reservedFunctionPrefixes() {
  return ['SMR_'];
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
        message: `${name} is an SMR sheet. Install will reuse it and will not rename or delete it.`
      });
    }
  }

  for (const name of functionNames) {
    if (reservedSimpleTriggers().includes(name)) {
      collisions.push({
        type: 'trigger',
        name,
        severity: 'keep',
        message: `Existing ${name} will be left untouched. Call SMR_onOpen() from your current onOpen if you want the menu.`
      });
    }
    if (name.startsWith('SMR_') === false && reservedSimpleTriggers().includes(name) === false) {
      continue;
    }
    if (name.startsWith('SMR_')) {
      collisions.push({
        type: 'function',
        name,
        severity: 'info',
        message: `${name} is part of the Service Manager Report namespace.`
      });
    }
  }

  const existingNonSmrSheets = sheetNames.filter((name) => !name.startsWith('SMR_'));
  const protectedHits = sheetNames.filter((name) => geauxProtectedSheetNames().includes(name));
  protectedHits.forEach((name) => {
    collisions.push({
      type: 'protected-sheet',
      name,
      severity: 'keep',
      message: `${name} is an existing Geaux Chevrolet tab. SMR will not write, rename, hide, or delete it.`
    });
  });
  return {
    reservedSheets,
    existingNonSmrSheets,
    protectedHits,
    collisions,
    safeToInstall: collisions.every((item) => item.severity !== 'block'),
    notes: [
      'SMR never defines onOpen, onEdit, doGet, or doPost.',
      'SMR never deletes, hides, or renames existing non-SMR sheets.',
      'SMR writes only to SMR_* tabs and ScriptProperties keys prefixed with SMR_.'
    ]
  };
}
