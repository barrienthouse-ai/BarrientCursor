import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  buildDailySnapshot,
  emptySalesTotals,
  findDailyReport,
  monthKey,
  nextBusinessDay,
  normalizeDailyReport,
  summarizeDealLog,
  toDateKey
} from './reporting.js';

export function emptyStore() {
  return {
    config: {
      timezone: 'America/Chicago',
      submitter: 'Sales Manager',
      storeName: 'Geaux Chevrolet',
      reportEmail: ''
    },
    reports: [],
    dealLog: []
  };
}

export function createStore(filePath) {
  let state = load(filePath);

  function persist() {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  function snapshot(dateKey, now) {
    return buildDailySnapshot({
      dateKey,
      reports: state.reports,
      dealLog: state.dealLog,
      now
    });
  }

  return {
    read() {
      return state;
    },
    snapshot,
    listReports(fromDate, toDate) {
      return inRange(state.reports, fromDate, toDate);
    },
    recall(dateKey) {
      return findDailyReport(state.reports, dateKey);
    },
    dealHint(dateKey) {
      return summarizeDealLog(state.dealLog, dateKey);
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
    fillFromDealLog(dateKey, traffic = {}, now = new Date()) {
      const hint = summarizeDealLog(state.dealLog, dateKey);
      const existing = findDailyReport(state.reports, dateKey) || {};
      return normalizeDailyReport(
        {
          date: toDateKey(dateKey, now),
          newSold: hint.daily.newSold,
          usedSold: hint.daily.usedSold,
          frontGross: hint.daily.frontGross,
          backGross: hint.daily.backGross,
          appointments: traffic.appointments ?? existing.appointments,
          shownAppointments: traffic.shownAppointments ?? existing.shownAppointments,
          showroomVisits: traffic.showroomVisits ?? existing.showroomVisits,
          nextDayAppointments: traffic.nextDayAppointments ?? existing.nextDayAppointments,
          notes: traffic.notes ?? existing.notes ?? '',
          source: 'deal-log'
        },
        now
      );
    },
    setReportEmail(email) {
      state.config.reportEmail = String(email || '').trim();
      persist();
      return state.config.reportEmail;
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
    dealLog: raw.dealLog || [],
    config: { ...emptyStore().config, ...(raw.config || {}) }
  };
}

export function seedStore() {
  const store = emptyStore();
  store.dealLog = [
    { date: '2026-08-24', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -151.91, backGross: 2124.43, deal: '75480' },
    { date: '2026-08-24', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -151.91, backGross: 2124.43, deal: '75481' },
    { date: '2026-08-24', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -151.91, backGross: 2124.43, deal: '75482' },
    { date: '2026-08-24', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -151.91, backGross: 2124.43, deal: '75483' },
    { date: '2026-08-25', type: 'RETAIL', dept: 'New', unit: 1, frontGross: 1724.98, backGross: 0, deal: '75490' },
    { date: '2026-08-25', type: 'RETAIL', dept: 'New', unit: 1, frontGross: 1724.97, backGross: 0, deal: '75491' },
    { date: '2026-08-25', type: 'RETAIL', dept: 'New', unit: 1, frontGross: 1724.97, backGross: 0, deal: '75492' },
    { date: '2026-08-25', type: 'RETAIL', dept: 'New', unit: 1, frontGross: 1724.98, backGross: 0, deal: '75493' },
    { date: '2026-08-25', type: 'Dealer Trade', dept: 'New', unit: 1, frontGross: -603.6, backGross: 0, deal: '75494' },
    { date: '2026-08-26', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -1070.15, backGross: 1258.51, deal: '75500' },
    { date: '2026-08-26', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -1070.15, backGross: 1258.51, deal: '75501' },
    { date: '2026-08-27', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -2296.58, backGross: 762.03, deal: '75505' },
    { date: '2026-08-27', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -2296.58, backGross: 762.03, deal: '75506' },
    { date: '2026-08-27', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -2296.57, backGross: 762.04, deal: '75507' },
    { date: '2026-08-28', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -1725.68, backGross: 2149.71, deal: '75510' },
    { date: '2026-08-29', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -3726.97, backGross: 1052.52, deal: '75512' },
    { date: '2026-08-29', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -3726.97, backGross: 1052.52, deal: '75513' },
    { date: '2026-08-31', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -720.01, backGross: 2042.71, deal: '75517' },
    { date: '2026-08-31', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -720.01, backGross: 2042.71, deal: '75518' },
    { date: '2026-08-31', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -720.01, backGross: 2042.71, deal: '75519' },
    { date: '2026-08-31', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -720.01, backGross: 2042.71, deal: '75520' },
    { date: '2026-08-31', type: 'RETAIL', dept: 'New', unit: 1, frontGross: -720.02, backGross: 2042.72, deal: '75521' },
    { date: '2026-08-31', type: 'RETAIL', dept: 'Used', unit: 1, frontGross: 0.01, backGross: 2042.71, deal: '75522' },
    { date: '2026-08-31', type: 'RETAIL', dept: 'Used', unit: 1, frontGross: 0, backGross: 2042.71, deal: '75523' },
    { date: '2026-08-31', type: 'Wholesale', dept: 'whsl', unit: 1, frontGross: -3936, backGross: 0, deal: '75524' }
  ];

  const days = [
    { date: '2026-08-24', newSold: 4, usedSold: 0, frontGross: -607.64, backGross: 8497.72, appointments: 11, shownAppointments: 7, showroomVisits: 16, nextDayAppointments: 9 },
    { date: '2026-08-25', newSold: 4, usedSold: 0, frontGross: 6899.9, backGross: 0, appointments: 10, shownAppointments: 8, showroomVisits: 14, nextDayAppointments: 8 },
    { date: '2026-08-26', newSold: 2, usedSold: 0, frontGross: -2140.3, backGross: 2517.02, appointments: 9, shownAppointments: 6, showroomVisits: 12, nextDayAppointments: 10 },
    { date: '2026-08-27', newSold: 3, usedSold: 0, frontGross: -6889.73, backGross: 2286.1, appointments: 12, shownAppointments: 8, showroomVisits: 15, nextDayAppointments: 11 },
    { date: '2026-08-28', newSold: 1, usedSold: 0, frontGross: -1725.68, backGross: 2149.71, appointments: 13, shownAppointments: 9, showroomVisits: 18, nextDayAppointments: 7 },
    { date: '2026-08-29', newSold: 2, usedSold: 0, frontGross: -7453.94, backGross: 2105.04, appointments: 8, shownAppointments: 5, showroomVisits: 11, nextDayAppointments: 12 },
    { date: '2026-08-31', newSold: 5, usedSold: 2, frontGross: -3600.06, backGross: 14298.98, appointments: 14, shownAppointments: 10, showroomVisits: 19, nextDayAppointments: 8 }
  ];

  for (const day of days) {
    store.reports.push(
      normalizeDailyReport({
        id: randomUUID(),
        ...day,
        notes: '',
        submittedBy: 'Sales Manager',
        submittedAt: `${day.date}T22:15:00.000Z`,
        source: 'manual',
        nextBusinessDate: nextBusinessDay(day.date)
      })
    );
  }

  return store;
}

export { monthKey, emptySalesTotals };
