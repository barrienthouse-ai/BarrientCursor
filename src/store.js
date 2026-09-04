import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DEAL_DELIVERED,
  DEAL_SOLD,
  DEAL_WORKING,
  buildDailySnapshot,
  findDailyReport,
  findMonthlyGoal,
  monthKey,
  nextWorkingDealId,
  normalizeDailyReport,
  normalizeMonthlyGoal,
  normalizeWorkingDeal,
  summarizeFleetDealLog,
  toDateKey
} from './reporting.js';

export function emptyStore() {
  return {
    config: {
      timezone: 'America/Chicago',
      submitter: 'Fleet Manager',
      storeName: 'Geaux Chevrolet'
    },
    reports: [],
    workingDeals: [],
    goals: [],
    dealLog: [],
    fleetCustomers: [
      'Entergy Louisiana',
      'Jefferson Parish',
      'St. Charles Parish',
      'Lafayette Utilities',
      'Acadian Ambulance',
      'Cox Communications',
      'AT&T Fleet',
      'Louisiana DOTD'
    ]
  };
}

export function createStore(filePath) {
  const state = load(filePath);

  function persist() {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  function snapshot(dateKey, now) {
    return buildDailySnapshot({
      dateKey,
      reports: state.reports,
      workingDeals: state.workingDeals,
      goals: state.goals,
      dealLog: state.dealLog,
      now
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
    recall(dateKey) {
      return findDailyReport(state.reports, dateKey);
    },
    dealHint(dateKey) {
      return summarizeFleetDealLog(state.dealLog, dateKey);
    },
    listWorkingDeals(status = 'open') {
      if (status === 'open') {
        return state.workingDeals.filter((row) => row.status === DEAL_WORKING || row.status === DEAL_SOLD);
      }
      if (status === 'all') {
        return [...state.workingDeals];
      }
      return state.workingDeals.filter((row) => row.status === status);
    },
    addWorkingDeal(payload, now = new Date()) {
      const openedDate = toDateKey(payload.openedDate || payload.date, now);
      const deal = normalizeWorkingDeal(
        {
          ...payload,
          id: payload.id || nextWorkingDealId(state.workingDeals, openedDate, now),
          submittedBy: payload.submittedBy || state.config.submitter,
          updatedAt: now.toISOString()
        },
        now
      );
      if (!deal.customer && !deal.account) {
        throw new Error('Customer or fleet account is required.');
      }
      state.workingDeals.push(deal);
      persist();
      return deal;
    },
    updateWorkingDeal(id, action, extras = {}, now = new Date()) {
      const index = state.workingDeals.findIndex((row) => row.id === id);
      if (index === -1) {
        throw new Error(`Working deal ${id} was not found.`);
      }
      const current = state.workingDeals[index];
      let status = current.status;
      if (action === 'sold') {
        status = DEAL_SOLD;
      } else if (action === 'deliver') {
        status = DEAL_DELIVERED;
      } else if (action === 'dead') {
        status = 'dead';
      } else if (action === 'reopen') {
        status = DEAL_WORKING;
      } else if (action === 'update') {
        status = extras.status || current.status;
      } else {
        throw new Error(`Unknown working deal action: ${action}`);
      }
      const next = normalizeWorkingDeal(
        {
          ...current,
          ...extras,
          id: current.id,
          openedDate: current.openedDate,
          status,
          submittedBy: extras.submittedBy || current.submittedBy || state.config.submitter,
          updatedAt: now.toISOString()
        },
        now
      );
      state.workingDeals[index] = next;
      persist();
      return next;
    },
    saveMonthlyGoal(payload, now = new Date()) {
      const goal = normalizeMonthlyGoal(
        {
          ...payload,
          submittedBy: payload.submittedBy || state.config.submitter,
          submittedAt: payload.submittedAt || now.toISOString()
        },
        now
      );
      state.goals = state.goals.filter((row) => row.month !== goal.month);
      const entry = { id: payload.id || randomUUID(), ...goal };
      state.goals.push(entry);
      persist();
      return entry;
    },
    recallGoal(dateKey) {
      return findMonthlyGoal(state.goals, dateKey);
    },
    saveDailyReport(payload, now = new Date()) {
      const report = normalizeDailyReport(
        {
          ...payload,
          submittedBy: payload.submittedBy || state.config.submitter,
          submittedAt: payload.submittedAt || now.toISOString()
        },
        now
      );
      const date = report.date;
      state.reports = state.reports.filter((row) => row.date !== date);
      const entry = { id: payload.id || randomUUID(), ...report };
      state.reports.push(entry);
      persist();
      const snap = snapshot(date, now);
      snap.report = entry;
      snap.metrics = entry.metrics;
      snap.saved = true;
      snap.fromDealLog = false;
      snap.unitsSource = 'saved';
      return snap;
    },
    fillFromDealLog(dateKey, extras = {}, now = new Date()) {
      const hint = summarizeFleetDealLog(state.dealLog, dateKey);
      const existing = findDailyReport(state.reports, dateKey) || {};
      const working = this.listWorkingDeals('open');
      return normalizeDailyReport(
        {
          date: toDateKey(dateKey, now),
          soldDeals: hint.daily.soldDeals,
          frontGross: hint.daily.frontGross,
          financeGross: hint.daily.financeGross,
          workingDeals: extras.workingDeals ?? existing.workingDeals ?? working.length,
          deliveries: extras.deliveries ?? existing.deliveries,
          courtesyDeliveries: extras.courtesyDeliveries ?? existing.courtesyDeliveries,
          expectedDeliveries: extras.expectedDeliveries ?? existing.expectedDeliveries,
          notes: extras.notes ?? existing.notes ?? '',
          source: 'deal-log'
        },
        now
      );
    },
    customers() {
      return [...state.fleetCustomers];
    }
  };
}

function inRange(rows, fromDate, toDate) {
  return rows
    .filter((row) => {
      if (fromDate && row.date < fromDate) {
        return false;
      }
      if (toDate && row.date > toDate) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
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
    workingDeals: raw.workingDeals || [],
    goals: raw.goals || [],
    dealLog: raw.dealLog || [],
    fleetCustomers: raw.fleetCustomers || emptyStore().fleetCustomers,
    config: { ...emptyStore().config, ...(raw.config || {}) }
  };
}

export function seedStore() {
  const store = emptyStore();
  store.dealLog = [
    { date: '2026-09-01', type: 'FLEET', dept: 'New', unit: 3, frontGross: 1840, financeGross: 960, deal: 'F9001', customer: 'Entergy Louisiana' },
    { date: '2026-09-01', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -720, financeGross: 2042, deal: '75530' },
    { date: '2026-09-02', type: 'FLEET', dept: 'New', unit: 2, frontGross: 1260, financeGross: 540, deal: 'F9004', customer: 'Jefferson Parish' },
    { date: '2026-09-03', type: 'Commercial', dept: 'New', unit: 4, frontGross: 2480, financeGross: 1100, deal: 'F9010', customer: 'Louisiana DOTD' },
    { date: '2026-09-03', type: 'FLEET', dept: 'Used', unit: 1, frontGross: 620, financeGross: 380, deal: 'F9011', customer: 'Acadian Ambulance' },
    { date: '2026-09-04', type: 'FLEET', dept: 'New', unit: 6, frontGross: 3120, financeGross: 1680, deal: 'F9018', customer: 'St. Charles Parish' }
  ];

  store.goals.push(
    normalizeMonthlyGoal({
      id: randomUUID(),
      month: '2026-09',
      unitGoal: 40,
      grossGoal: 48000,
      notes: 'September municipal and utility push.',
      submittedBy: 'Fleet Manager',
      submittedAt: '2026-09-01T13:00:00.000Z'
    })
  );

  const days = [
    { date: '2026-09-01', soldDeals: 3, workingDeals: 8, frontGross: 1840, financeGross: 960, deliveries: 2, courtesyDeliveries: 1, expectedDeliveries: 11 },
    { date: '2026-09-02', soldDeals: 2, workingDeals: 9, frontGross: 1260, financeGross: 540, deliveries: 3, courtesyDeliveries: 0, expectedDeliveries: 12 },
    { date: '2026-09-03', soldDeals: 5, workingDeals: 7, frontGross: 3100, financeGross: 1480, deliveries: 4, courtesyDeliveries: 2, expectedDeliveries: 10 },
    { date: '2026-09-04', soldDeals: 6, workingDeals: 8, frontGross: 3120, financeGross: 1680, deliveries: 5, courtesyDeliveries: 1, expectedDeliveries: 13 }
  ];

  for (const day of days) {
    store.reports.push(
      normalizeDailyReport({
        id: randomUUID(),
        ...day,
        notes: '',
        submittedBy: 'Fleet Manager',
        submittedAt: `${day.date}T22:10:00.000Z`,
        source: 'manual'
      })
    );
  }

  store.workingDeals.push(
    {
      id: 'FLM-20260902-001',
      openedDate: '2026-09-02',
      customer: 'Marcus Hall',
      account: 'Entergy Louisiana',
      stock: 'N28411',
      vehicle: '2026 Silverado 2500 HD',
      units: 4,
      frontGross: 2200,
      financeGross: 800,
      totalGross: 3000,
      expectedDelivery: '2026-09-08',
      status: DEAL_WORKING,
      notes: 'Waiting on upfit quotes for service bodies.',
      submittedBy: 'Fleet Manager',
      updatedAt: '2026-09-03T15:20:00.000Z'
    },
    {
      id: 'FLM-20260903-001',
      openedDate: '2026-09-03',
      customer: 'Dana Ruiz',
      account: 'Jefferson Parish',
      stock: 'N28455',
      vehicle: '2026 Tahoe PPV',
      units: 3,
      frontGross: 1800,
      financeGross: 450,
      totalGross: 2250,
      expectedDelivery: '2026-09-04',
      status: DEAL_SOLD,
      notes: 'Paperwork complete. Courtesy drop at the parish shop if they cannot pick up.',
      submittedBy: 'Fleet Manager',
      updatedAt: '2026-09-04T11:05:00.000Z'
    },
    {
      id: 'FLM-20260901-001',
      openedDate: '2026-09-01',
      customer: 'Chris Nguyen',
      account: 'Louisiana DOTD',
      stock: 'N28390',
      vehicle: '2026 Silverado 1500',
      units: 2,
      frontGross: 960,
      financeGross: 240,
      totalGross: 1200,
      expectedDelivery: '2026-09-10',
      status: DEAL_WORKING,
      notes: 'Bid awarded. VIN assignment pending.',
      submittedBy: 'Fleet Manager',
      updatedAt: '2026-09-02T16:40:00.000Z'
    },
    {
      id: 'FLM-20260828-001',
      openedDate: '2026-08-28',
      customer: 'Patrice Cole',
      account: 'Acadian Ambulance',
      stock: 'U11902',
      vehicle: '2023 Express 3500',
      units: 1,
      frontGross: 620,
      financeGross: 380,
      totalGross: 1000,
      expectedDelivery: '2026-09-03',
      status: DEAL_DELIVERED,
      notes: 'Delivered to the Broussard hub.',
      submittedBy: 'Fleet Manager',
      updatedAt: '2026-09-03T18:12:00.000Z'
    }
  );

  return store;
}

export { monthKey };
