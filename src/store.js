import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  PERIOD_DAILY,
  applyHeatTransition,
  buildDailySnapshot,
  filterByDate,
  monthKey,
  heatAssignment,
  nextHeatCaseId,
  normalizeHeatStatus,
  normalizeSeverity,
  toDateKey,
  toNumber
} from './reporting.js';

const DEFAULT_ROSTER = [
  'BIG AL',
  'ELECTRIC-T',
  'DIESEL-E',
  'INTERNAL-F',
  'HEAVY-C',
  'SPECIAL-K',
  'LIL-J',
  'EASY-E',
  'DUEL FUEL-A'
];

export function emptyStore() {
  return {
    techHours: [],
    gross: [],
    heatCases: [],
    repairOrders: [],
    roster: [...DEFAULT_ROSTER],
    config: {
      timezone: 'America/Chicago',
      submitter: 'Service Manager'
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
      techHours: state.techHours,
      grossEntries: state.gross,
      repairOrders: state.repairOrders,
      heatCases: state.heatCases,
      roster: state.roster
    });
  }

  return {
    path: filePath,
    read() {
      return structuredClone(state);
    },
    snapshot,
    listTechHours(fromDate, toDate) {
      return inRange(state.techHours, fromDate, toDate);
    },
    recallTechHours(dateKey) {
      const key = toDateKey(dateKey);
      return filterByDate(state.techHours, key);
    },
    saveTechHours(payload) {
      const date = toDateKey(payload.date);
      const submittedAt = payload.submittedAt || new Date().toISOString();
      const submittedBy = payload.submittedBy || state.config.submitter;
      const incoming = Array.isArray(payload.rows) ? payload.rows : [];
      state.techHours = state.techHours.filter((row) => row.date !== date);
      const saved = incoming
        .filter((row) => String(row.techName || '').trim())
        .map((row) => ({
          id: row.id || randomUUID(),
          date,
          techName: String(row.techName).trim(),
          clockHours: toNumber(row.clockHours),
          soldHours: toNumber(row.soldHours),
          openCount: toNumber(row.openCount),
          closedCount: toNumber(row.closedCount),
          writtenCount: toNumber(row.writtenCount),
          notes: row.notes || '',
          submittedBy,
          submittedAt
        }));
      state.techHours.push(...saved);
      persist();
      return { date, rows: saved, snapshot: snapshot(date) };
    },
    listGross(fromDate, toDate, period) {
      let rows = inRange(state.gross, fromDate, toDate);
      if (period) {
        rows = rows.filter((row) => row.period === period);
      }
      return rows;
    },
    saveGross(payload) {
      const period = payload.period === 'monthly' ? 'monthly' : PERIOD_DAILY;
      const date = toDateKey(payload.date);
      const month = payload.month || monthKey(date);
      const submittedAt = payload.submittedAt || new Date().toISOString();
      const submittedBy = payload.submittedBy || state.config.submitter;
      if (period === 'monthly') {
        state.gross = state.gross.filter((row) => !(row.period === 'monthly' && (row.month === month || (row.date && row.date.startsWith(month)))));
      } else {
        state.gross = state.gross.filter((row) => !(row.period === PERIOD_DAILY && row.date === date));
      }
      const entry = {
        id: payload.id || randomUUID(),
        date: period === 'monthly' ? `${month}-01` : date,
        month,
        period,
        laborGross: toNumber(payload.laborGross),
        partsGross: 0,
        otherGross: toNumber(payload.otherGross),
        notes: payload.notes || '',
        submittedBy,
        submittedAt
      };
      state.gross.push(entry);
      persist();
      return { entry, snapshot: snapshot(date) };
    },
    listHeatCases(status = 'all') {
      if (status === 'open') {
        return state.heatCases.filter((row) => normalizeHeatStatus(row.status) !== 'resolved');
      }
      if (status === 'resolved') {
        return state.heatCases.filter((row) => normalizeHeatStatus(row.status) === 'resolved');
      }
      return [...state.heatCases];
    },
    addHeatCase(payload) {
      const openedDate = toDateKey(payload.openedDate || payload.date);
      const now = payload.updatedAt || new Date().toISOString();
      const item = {
        id: payload.id || nextHeatCaseId(state.heatCases, openedDate),
        openedDate,
        customer: String(payload.customer || '').trim(),
        roNumber: String(payload.roNumber || '').trim(),
        vehicle: String(payload.vehicle || '').trim(),
        issue: String(payload.issue || '').trim(),
        severity: normalizeSeverity(payload.severity),
        ...heatAssignment(payload),
        status: normalizeHeatStatus(payload.status || 'open'),
        briefedAt: payload.briefedAt || '',
        resolvedAt: payload.resolvedAt || '',
        resolutionNotes: payload.resolutionNotes || '',
        updatedAt: now
      };
      if (!item.issue) {
        throw new Error('Heat case issue is required.');
      }
      state.heatCases.push(item);
      persist();
      return item;
    },
    updateHeatCase(id, action, notes = '') {
      const index = state.heatCases.findIndex((row) => row.id === id);
      if (index === -1) {
        throw new Error(`Heat case ${id} was not found.`);
      }
      const timestamp = new Date().toISOString();
      const next = applyHeatTransition(state.heatCases[index], action, timestamp, notes);
      state.heatCases[index] = next;
      persist();
      return next;
    },
    listRepairOrders(fromDate, toDate) {
      return inRange(state.repairOrders, fromDate, toDate);
    },
    recallRepairOrders(dateKey) {
      const key = toDateKey(dateKey);
      const rows = filterByDate(state.repairOrders, key);
      return rows.length ? rows[rows.length - 1] : null;
    },
    saveRepairOrders(payload) {
      const date = toDateKey(payload.date);
      const submittedAt = payload.submittedAt || new Date().toISOString();
      const submittedBy = payload.submittedBy || state.config.submitter;
      state.repairOrders = state.repairOrders.filter((row) => row.date !== date);
      const entry = {
        id: payload.id || randomUUID(),
        date,
        openCount: toNumber(payload.openCount),
        closedCount: toNumber(payload.closedCount),
        writtenCount: toNumber(payload.writtenCount != null && payload.writtenCount !== '' ? payload.writtenCount : payload.openedCount),
        notes: payload.notes || '',
        submittedBy,
        submittedAt
      };
      state.repairOrders.push(entry);
      persist();
      return { entry, snapshot: snapshot(date) };
    },
    saveDailyReport(payload) {
      const date = toDateKey(payload.date);
      if (payload.techHours) {
        this.saveTechHours({ date, ...payload.techHours, submittedBy: payload.submittedBy });
      }
      if (payload.repairOrders) {
        this.saveRepairOrders({ date, ...payload.repairOrders, submittedBy: payload.submittedBy });
      }
      if (payload.gross) {
        this.saveGross({ date, period: 'daily', ...payload.gross, submittedBy: payload.submittedBy });
      }
      return snapshot(date);
    },
    roster() {
      return [...state.roster];
    }
  };
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
    techHours: raw.techHours || [],
    gross: raw.gross || [],
    heatCases: raw.heatCases || [],
    repairOrders: raw.repairOrders || [],
    roster: raw.roster || [...DEFAULT_ROSTER],
    config: { ...emptyStore().config, ...(raw.config || {}) }
  };
}

export function seedStore() {
  const store = emptyStore();
  const days = [
    {
      date: '2026-08-24',
      hours: [
        ['BIG AL', 8, 7.2],
        ['ELECTRIC-T', 8, 6.0],
        ['DIESEL-E', 8, 8.1]
      ],
      gross: [3180, 90],
      ro: [30, 12, 14]
    },
    {
      date: '2026-08-25',
      hours: [
        ['HEAVY-C', 8, 9.4],
        ['SPECIAL-K', 8, 5.5],
        ['LIL-J', 8, 4.2]
      ],
      gross: [2890, 110],
      ro: [31, 14, 16]
    },
    {
      date: '2026-08-26',
      hours: [
        ['BIG AL', 8, 2.4],
        ['ELECTRIC-T', 8, 0],
        ['DIESEL-E', 8, 0.7],
        ['HEAVY-C', 8, 8.6],
        ['SPECIAL-K', 8, 4.0]
      ],
      gross: [4120, 240],
      ro: [38, 19, 22]
    },
    {
      date: '2026-08-27',
      hours: [
        ['BIG AL', 8, 3.6],
        ['INTERNAL-F', 8, 7.6],
        ['HEAVY-C', 8, 8.0],
        ['DUEL FUEL-A', 8, 12.6],
        ['LIL-J', 8, 2.6]
      ],
      gross: [4585, 180],
      ro: [36, 21, 24]
    },
    {
      date: '2026-08-28',
      hours: [
        ['BIG AL', 8, 1.1],
        ['DIESEL-E', 8, 4.0],
        ['INTERNAL-F', 8, 3.4],
        ['HEAVY-C', 8, 15.5],
        ['SPECIAL-K', 8, 7.4]
      ],
      gross: [4390, 310],
      ro: [34, 23, 20]
    },
    {
      date: '2026-08-29',
      hours: [
        ['ELECTRIC-T', 8, 19.2],
        ['DIESEL-E', 8, 14.5],
        ['INTERNAL-F', 8, 9.9],
        ['HEAVY-C', 8, 13.0],
        ['SPECIAL-K', 8, 13.1]
      ],
      gross: [4215, 195],
      ro: [33, 18, 21]
    }
  ];

  for (const day of days) {
    for (const [techName, clockHours, soldHours] of day.hours) {
      store.techHours.push({
        id: randomUUID(),
        date: day.date,
        techName,
        clockHours,
        soldHours,
        notes: '',
        submittedBy: 'Service Manager',
        submittedAt: `${day.date}T17:15:00.000Z`
      });
    }
    store.gross.push({
      id: randomUUID(),
      date: day.date,
      month: day.date.slice(0, 7),
      period: 'daily',
      laborGross: day.gross[0],
      partsGross: 0,
      otherGross: day.gross[1],
      notes: '',
      submittedBy: 'Service Manager',
      submittedAt: `${day.date}T17:15:00.000Z`
    });
    store.repairOrders.push({
      id: randomUUID(),
      date: day.date,
      openCount: day.ro[0],
      closedCount: day.ro[1],
      writtenCount: day.ro[2],
      notes: '',
      submittedBy: 'Service Manager',
      submittedAt: `${day.date}T17:15:00.000Z`
    });
  }

  store.heatCases.push(
    {
      id: 'HEAT-20260827-001',
      openedDate: '2026-08-27',
      customer: 'Maria Delgado',
      roNumber: 'RO-44118',
      vehicle: '2022 Chevrolet Silverado',
      issue: 'Comeback for repeat transmission shudder after first repair. Customer waiting on loaner.',
      severity: 'high',
      owner: 'Cody Raffary',
      advisor: 'Cody Raffary',
      technician: 'BIG AL',
      status: 'briefed',
      briefedAt: '2026-08-28T13:40:00.000Z',
      resolvedAt: '',
      resolutionNotes: '',
      updatedAt: '2026-08-28T13:40:00.000Z'
    },
    {
      id: 'HEAT-20260828-001',
      openedDate: '2026-08-28',
      customer: 'Owen Price',
      roNumber: 'RO-44152',
      vehicle: '2024 Hyundai Tucson',
      issue: 'Safety concern: customer reports brake pedal fade after shop visit. Vehicle parked pending inspection.',
      severity: 'critical',
      owner: 'Cody Raffary',
      advisor: 'Cody Raffary',
      technician: 'SPECIAL-K',
      status: 'open',
      briefedAt: '',
      resolvedAt: '',
      resolutionNotes: '',
      updatedAt: '2026-08-28T16:05:00.000Z'
    },
    {
      id: 'HEAT-20260825-001',
      openedDate: '2026-08-25',
      customer: 'Lena Cho',
      roNumber: 'RO-44091',
      vehicle: '2021 GMC Yukon',
      issue: 'Extended wait and missed promised time. Customer requested manager call.',
      severity: 'medium',
      owner: 'Cody Raffary',
      advisor: 'Cody Raffary',
      technician: 'EASY-E',
      status: 'resolved',
      briefedAt: '2026-08-25T15:10:00.000Z',
      resolvedAt: '2026-08-26T11:20:00.000Z',
      resolutionNotes: 'Called customer, waived alignment, rebooked for Friday with shuttle.',
      updatedAt: '2026-08-26T11:20:00.000Z'
    }
  );

  return store;
}
