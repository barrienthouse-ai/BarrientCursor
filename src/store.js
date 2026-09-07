import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  THRESHOLDS,
  applyBoardAction,
  buildDailySnapshot,
  findDaily,
  nextItemId,
  normalizeBackorderStatus,
  normalizeCoreStatus,
  normalizeDailyReport,
  normalizeLostStatus,
  normalizeSeverity,
  normalizeSopStatus,
  toDateKey,
  toNumber,
  withSopAge
} from './reporting.js';

export function emptyStore() {
  return {
    reports: [],
    lostSales: [],
    sopItems: [],
    backorders: [],
    cores: [],
    config: {
      timezone: 'America/Chicago',
      submitter: 'Parts Manager',
      storeName: 'Geaux Chevrolet',
      reportEmail: '',
      capitalLimit: THRESHOLDS.capitalDefaultLimit,
      rimTargetPercent: THRESHOLDS.rimDefaultTarget
    }
  };
}

export function createStore(filePath) {
  const state = load(filePath);

  function persist() {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  function snapshot(dateKey) {
    return buildDailySnapshot({
      dateKey,
      reports: state.reports,
      lostSales: state.lostSales,
      sopItems: state.sopItems,
      backorders: state.backorders,
      cores: state.cores,
      config: state.config
    });
  }

  return {
    path: filePath,
    read() {
      return structuredClone(state);
    },
    snapshot,
    listReports(fromDate, toDate) {
      return inRange(state.reports, fromDate, toDate);
    },
    recallDaily(dateKey) {
      return findDaily(state.reports, dateKey);
    },
    saveDailyReport(payload) {
      const date = toDateKey(payload.date);
      const submittedAt = payload.submittedAt || new Date().toISOString();
      const submittedBy = payload.submittedBy || state.config.submitter;
      const capitalLimit = payload.capitalLimit != null && payload.capitalLimit !== ''
        ? toNumber(payload.capitalLimit)
        : state.config.capitalLimit;
      const rimTargetPercent = payload.rimTargetPercent != null && payload.rimTargetPercent !== ''
        ? toNumber(payload.rimTargetPercent)
        : state.config.rimTargetPercent;
      state.config.capitalLimit = capitalLimit;
      state.config.rimTargetPercent = rimTargetPercent;
      const entry = normalizeDailyReport({
        ...payload,
        id: payload.id || findDaily(state.reports, date)?.id || randomUUID(),
        date,
        capitalLimit,
        rimTargetPercent,
        submittedBy,
        submittedAt
      });
      state.reports = state.reports.filter((row) => row.date !== date);
      state.reports.push(entry);
      persist();
      return snapshot(date);
    },
    listLostSales(status = 'all') {
      return filterStatus(state.lostSales, status, normalizeLostStatus, 'open');
    },
    addLostSale(payload) {
      const openedDate = toDateKey(payload.openedDate || payload.date);
      const partNumber = String(payload.partNumber || '').trim().toUpperCase();
      if (!partNumber) {
        throw new Error('Lost sale part number is required.');
      }
      const item = {
        id: payload.id || nextItemId('LSL', state.lostSales, openedDate),
        kind: 'lost',
        openedDate,
        date: openedDate,
        partNumber,
        description: String(payload.description || '').trim(),
        requestedBy: String(payload.requestedBy || '').trim(),
        source: String(payload.source || 'service').trim().toLowerCase(),
        timesRequested: Math.max(1, toNumber(payload.timesRequested, 1)),
        dollars: toNumber(payload.dollars),
        status: normalizeLostStatus(payload.status),
        notes: payload.notes || '',
        closedAt: payload.closedAt || '',
        updatedAt: payload.updatedAt || new Date().toISOString()
      };
      state.lostSales.push(item);
      persist();
      return item;
    },
    updateLostSale(id, action, notes = '') {
      return updateBoardItem(state.lostSales, id, action, notes, persist);
    },
    listSop(status = 'all') {
      const rows = filterStatus(state.sopItems, status, normalizeSopStatus, 'rec');
      return rows.map((row) => withSopAge(row, toDateKey(new Date())));
    },
    addSop(payload) {
      const receivedDate = toDateKey(payload.receivedDate || payload.openedDate || payload.date);
      const partNumber = String(payload.partNumber || '').trim().toUpperCase();
      if (!partNumber) {
        throw new Error('SOP part number is required.');
      }
      const item = {
        id: payload.id || nextItemId('SOP', state.sopItems, receivedDate),
        kind: 'sop',
        openedDate: receivedDate,
        receivedDate,
        partNumber,
        description: String(payload.description || '').trim(),
        customer: String(payload.customer || '').trim(),
        roNumber: String(payload.roNumber || '').trim(),
        dollars: toNumber(payload.dollars),
        status: normalizeSopStatus(payload.status),
        notes: payload.notes || '',
        closedAt: payload.closedAt || '',
        updatedAt: payload.updatedAt || new Date().toISOString()
      };
      state.sopItems.push(item);
      persist();
      return withSopAge(item, toDateKey(new Date()));
    },
    updateSop(id, action, notes = '') {
      return updateBoardItem(state.sopItems, id, action, notes, persist);
    },
    listBackorders(status = 'all') {
      return filterStatus(state.backorders, status, normalizeBackorderStatus, 'open');
    },
    addBackorder(payload) {
      const openedDate = toDateKey(payload.openedDate || payload.date);
      const partNumber = String(payload.partNumber || '').trim().toUpperCase();
      if (!partNumber) {
        throw new Error('Backorder part number is required.');
      }
      const item = {
        id: payload.id || nextItemId('BO', state.backorders, openedDate),
        kind: 'backorder',
        openedDate,
        partNumber,
        description: String(payload.description || '').trim(),
        vehicle: String(payload.vehicle || '').trim(),
        reason: String(payload.reason || 'service bay').trim(),
        eta: String(payload.eta || '').trim(),
        severity: normalizeSeverity(payload.severity || (String(payload.reason || '').toLowerCase().includes('stop') ? 'critical' : 'high')),
        status: normalizeBackorderStatus(payload.status),
        notes: payload.notes || '',
        receivedAt: payload.receivedAt || '',
        closedAt: payload.closedAt || '',
        updatedAt: payload.updatedAt || new Date().toISOString()
      };
      state.backorders.push(item);
      persist();
      return item;
    },
    updateBackorder(id, action, notes = '') {
      return updateBoardItem(state.backorders, id, action, notes, persist);
    },
    listCores(status = 'all') {
      if (status === 'open' || status === 'outstanding') {
        return state.cores.filter((row) => normalizeCoreStatus(row.status) === 'outstanding');
      }
      if (status === 'returned' || status === 'closed') {
        return state.cores.filter((row) => normalizeCoreStatus(row.status) === 'returned');
      }
      return [...state.cores];
    },
    addCore(payload) {
      const openedDate = toDateKey(payload.openedDate || payload.date);
      const partNumber = String(payload.partNumber || '').trim().toUpperCase();
      if (!partNumber) {
        throw new Error('Core part number is required.');
      }
      const item = {
        id: payload.id || nextItemId('CRA', state.cores, openedDate),
        kind: 'core',
        openedDate,
        partNumber,
        description: String(payload.description || '').trim(),
        accountOrTech: String(payload.accountOrTech || payload.account || payload.technician || '').trim(),
        dollars: toNumber(payload.dollars),
        daysOutstanding: toNumber(payload.daysOutstanding),
        status: normalizeCoreStatus(payload.status),
        notes: payload.notes || '',
        closedAt: payload.closedAt || '',
        updatedAt: payload.updatedAt || new Date().toISOString()
      };
      state.cores.push(item);
      persist();
      return item;
    },
    updateCore(id, action, notes = '') {
      return updateBoardItem(state.cores, id, action, notes, persist);
    },
    setReportEmail(email) {
      state.config.reportEmail = String(email || '').trim();
      persist();
      return state.config.reportEmail;
    }
  };
}

function filterStatus(rows, status, normalize, openValue) {
  if (status === 'open') {
    return rows.filter((row) => {
      const current = normalize(row.status);
      return current === openValue || current === 'outstanding';
    });
  }
  if (status === 'closed' || status === 'resolved') {
    return rows.filter((row) => {
      const current = normalize(row.status);
      return current !== openValue && current !== 'outstanding' && current !== 'rec';
    });
  }
  return [...rows];
}

function updateBoardItem(list, id, action, notes, persist) {
  const index = list.findIndex((row) => row.id === id);
  if (index === -1) {
    throw new Error(`Item ${id} was not found.`);
  }
  const timestamp = new Date().toISOString();
  const next = applyBoardAction(list[index], action, timestamp, notes);
  list[index] = next;
  persist();
  return next;
}

function inRange(rows, fromDate, toDate) {
  return rows.filter((row) => {
    if (fromDate && row.date < fromDate) {
      return false;
    }
    if (toDate && row.date > toDate) {
      return false;
    }
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function load(filePath) {
  if (!existsSync(filePath)) {
    const seeded = seedStore();
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  return {
    ...emptyStore(),
    ...raw,
    reports: raw.reports || [],
    lostSales: raw.lostSales || [],
    sopItems: raw.sopItems || [],
    backorders: raw.backorders || [],
    cores: raw.cores || [],
    config: { ...emptyStore().config, ...(raw.config || {}) }
  };
}

export function seedStore() {
  const store = emptyStore();
  const days = [
    {
      date: '2026-09-02',
      inventoryValue: 486420,
      n3mValue: 31200,
      n6mValue: 41880,
      overstockValue: 27400,
      payablesOpen: 61200,
      retailSales: 8420,
      wholesaleSales: 3910,
      internalSales: 6125,
      counterWaitMinutes: 4,
      lostSalesCount: 3,
      lostSalesDollars: 640,
      sopReceivedCount: 6,
      sopAgedCount: 1,
      sopAgedValue: 890,
      rimCompliancePercent: 91.2,
      emergencyOrderCount: 2,
      emergencyFreightCost: 86,
      outstandingCoresValue: 1840,
      wholesaleStops: 11,
      hotshotRuns: 1,
      deliveryFuelCost: 74,
      notes: 'Tuesday stock order landed. Two wholesale stops delayed for a hot-shot to a body shop in Laplace.'
    },
    {
      date: '2026-09-03',
      inventoryValue: 498110,
      n3mValue: 32880,
      n6mValue: 44120,
      overstockValue: 31250,
      payablesOpen: 70140,
      retailSales: 9105,
      wholesaleSales: 4280,
      internalSales: 7040,
      counterWaitMinutes: 6,
      lostSalesCount: 5,
      lostSalesDollars: 1285,
      sopReceivedCount: 8,
      sopAgedCount: 2,
      sopAgedValue: 1640,
      rimCompliancePercent: 88.4,
      emergencyOrderCount: 4,
      emergencyFreightCost: 210,
      outstandingCoresValue: 2215,
      wholesaleStops: 13,
      hotshotRuns: 2,
      deliveryFuelCost: 118,
      notes: 'RIM slipped after a CSO week. Same 19420472 control module hit LSL twice.'
    },
    {
      date: '2026-09-04',
      inventoryValue: 512880,
      n3mValue: 35110,
      n6mValue: 46890,
      overstockValue: 38940,
      payablesOpen: 82400,
      retailSales: 7760,
      wholesaleSales: 5125,
      internalSales: 6890,
      counterWaitMinutes: 8,
      lostSalesCount: 6,
      lostSalesDollars: 1740,
      sopReceivedCount: 9,
      sopAgedCount: 3,
      sopAgedValue: 2410,
      rimCompliancePercent: 86.1,
      emergencyOrderCount: 6,
      emergencyFreightCost: 340,
      outstandingCoresValue: 2680,
      wholesaleStops: 12,
      hotshotRuns: 3,
      deliveryFuelCost: 162,
      notes: 'Inventory over capital after GM RIM pad buy. Counter wait spiked at 10:30 lunch overlap.'
    },
    {
      date: '2026-09-05',
      inventoryValue: 521340,
      n3mValue: 36220,
      n6mValue: 48150,
      overstockValue: 40110,
      payablesOpen: 79120,
      retailSales: 10240,
      wholesaleSales: 4680,
      internalSales: 8120,
      counterWaitMinutes: 7.5,
      lostSalesCount: 4,
      lostSalesDollars: 980,
      sopReceivedCount: 7,
      sopAgedCount: 3,
      sopAgedValue: 2685,
      rimCompliancePercent: 87.0,
      emergencyOrderCount: 5,
      emergencyFreightCost: 275,
      outstandingCoresValue: 2490,
      wholesaleStops: 14,
      hotshotRuns: 2,
      deliveryFuelCost: 141,
      notes: 'Friday close. Need GM to authorize return on 90-day N6M before month-end write-off risk grows.'
    }
  ];

  for (const day of days) {
    store.reports.push(normalizeDailyReport({
      id: randomUUID(),
      ...day,
      capitalLimit: 500000,
      rimTargetPercent: 90,
      submittedBy: 'Parts Manager',
      submittedAt: `${day.date}T17:20:00.000Z`
    }));
  }

  store.lostSales.push(
    {
      id: 'LSL-20260903-001',
      kind: 'lost',
      openedDate: '2026-09-03',
      date: '2026-09-03',
      partNumber: '19420472',
      description: 'Body control module — Silverado 1500',
      requestedBy: 'Cody Raffary',
      source: 'service',
      timesRequested: 2,
      dollars: 485,
      status: 'open',
      notes: 'Looked up twice; not on RIM. Override the matrix.',
      closedAt: '',
      updatedAt: '2026-09-03T15:10:00.000Z'
    },
    {
      id: 'LSL-20260904-001',
      kind: 'lost',
      openedDate: '2026-09-04',
      date: '2026-09-04',
      partNumber: '19420472',
      description: 'Body control module — Silverado 1500',
      requestedBy: 'Retail counter',
      source: 'retail',
      timesRequested: 1,
      dollars: 485,
      status: 'open',
      notes: 'Walk-in wanted same-day. Sent to GM dealer in Kenner.',
      closedAt: '',
      updatedAt: '2026-09-04T11:40:00.000Z'
    },
    {
      id: 'LSL-20260904-002',
      kind: 'lost',
      openedDate: '2026-09-04',
      date: '2026-09-04',
      partNumber: '84732459',
      description: 'EV coolant pump — Equinox EV',
      requestedBy: 'ELECTRIC-T',
      source: 'service',
      timesRequested: 1,
      dollars: 320,
      status: 'open',
      notes: 'Constraint from GM. Customer waiting on loaner.',
      closedAt: '',
      updatedAt: '2026-09-04T14:05:00.000Z'
    }
  );

  store.sopItems.push(
    {
      id: 'SOP-20260820-001',
      kind: 'sop',
      openedDate: '2026-08-20',
      receivedDate: '2026-08-20',
      partNumber: '84710922',
      description: 'Camaro SS rear bumper cover',
      customer: 'Maria Delgado',
      roNumber: 'RO-44118',
      dollars: 890,
      status: 'rec',
      notes: 'Customer has not brought the car back. Past 14 days — return window closing.',
      closedAt: '',
      updatedAt: '2026-08-20T16:00:00.000Z'
    },
    {
      id: 'SOP-20260828-001',
      kind: 'sop',
      openedDate: '2026-08-28',
      receivedDate: '2026-08-28',
      partNumber: '85123411',
      description: 'Tahoe running board — passenger',
      customer: 'Owen Price',
      roNumber: 'RO-44152',
      dollars: 410,
      status: 'rec',
      notes: 'REC 7+ days. Advisor has not scheduled the install.',
      closedAt: '',
      updatedAt: '2026-08-28T09:20:00.000Z'
    },
    {
      id: 'SOP-20260902-001',
      kind: 'sop',
      openedDate: '2026-09-02',
      receivedDate: '2026-09-02',
      partNumber: '23240687',
      description: 'Silverado bed liner',
      customer: 'Geaux Fleet / Parish',
      roNumber: 'RO-44201',
      dollars: 275,
      status: 'rec',
      notes: 'Fresh receipt. Fleet unit expected Friday.',
      closedAt: '',
      updatedAt: '2026-09-02T13:15:00.000Z'
    }
  );

  store.backorders.push(
    {
      id: 'BO-20260829-001',
      kind: 'backorder',
      openedDate: '2026-08-29',
      partNumber: '24294977',
      description: '10-speed transmission control module',
      vehicle: '2023 Silverado 1500 — body shop',
      reason: 'stop-sale / body shop',
      eta: '2026-09-12',
      severity: 'critical',
      status: 'open',
      notes: 'Vehicle stuck in body. GM constraint.',
      receivedAt: '',
      closedAt: '',
      updatedAt: '2026-08-29T10:00:00.000Z'
    },
    {
      id: 'BO-20260903-001',
      kind: 'backorder',
      openedDate: '2026-09-03',
      partNumber: '84732459',
      description: 'EV coolant pump — Equinox EV',
      vehicle: '2024 Equinox EV — service bay 4',
      reason: 'service bay',
      eta: '2026-09-09',
      severity: 'high',
      status: 'open',
      notes: 'Bay blocked pending pump. Loaner out.',
      receivedAt: '',
      closedAt: '',
      updatedAt: '2026-09-03T16:40:00.000Z'
    }
  );

  store.cores.push(
    {
      id: 'CRA-20260822-001',
      kind: 'core',
      openedDate: '2026-08-22',
      partNumber: '84008048',
      description: 'Alternator core — 6.2L',
      accountOrTech: 'HEAVY-C',
      dollars: 145,
      daysOutstanding: 16,
      status: 'outstanding',
      notes: 'Still on the shop cart. Tech has not tagged it.',
      closedAt: '',
      updatedAt: '2026-08-22T17:00:00.000Z'
    },
    {
      id: 'CRA-20260901-001',
      kind: 'core',
      openedDate: '2026-09-01',
      partNumber: '24291682',
      description: '8L90 transmission core',
      accountOrTech: 'River Parish Collision',
      dollars: 1250,
      daysOutstanding: 6,
      status: 'outstanding',
      notes: 'Wholesale hot-shot delivered the unit. Core not on the return truck.',
      closedAt: '',
      updatedAt: '2026-09-01T12:30:00.000Z'
    },
    {
      id: 'CRA-20260818-001',
      kind: 'core',
      openedDate: '2026-08-18',
      partNumber: '12698848',
      description: 'Starter core — 5.3L',
      accountOrTech: 'LIL-J',
      dollars: 85,
      daysOutstanding: 0,
      status: 'returned',
      notes: 'Credited 2026-09-02.',
      closedAt: '2026-09-02T14:10:00.000Z',
      updatedAt: '2026-09-02T14:10:00.000Z'
    }
  );

  return store;
}
