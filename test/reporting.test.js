import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditWorkbook,
  buildDailySnapshot,
  closeRate,
  findDateSpan,
  formatPercent,
  isRetailType,
  lastDealScanCellsRead,
  lastFilledDealIndex,
  nextBusinessDay,
  normalizeDailyReport,
  parseSheetDateKey,
  reservedSheetNames,
  reservedSimpleTriggers,
  rollupReports,
  showRate,
  summarizeDealLog,
  toDateKey
} from '../src/reporting.js';

describe('date helpers', () => {
  it('keeps ISO date keys', () => {
    assert.equal(toDateKey('2026-08-31'), '2026-08-31');
  });

  it('parses DEALINPUT date formats used on the live sheet', () => {
    assert.equal(parseSheetDateKey('8/31/2026'), '2026-08-31');
    assert.equal(parseSheetDateKey('08/31/26'), '2026-08-31');
    assert.equal(parseSheetDateKey(46265), '2026-08-31');
    assert.equal(parseSheetDateKey(new Date(Date.UTC(2026, 7, 31))), '2026-08-31');
    assert.equal(toDateKey('8/31/2026'), '2026-08-31');
  });

  it('skips Sunday when finding the next business day', () => {
    assert.equal(nextBusinessDay('2026-08-31'), '2026-09-01');
    assert.equal(nextBusinessDay('2026-08-28'), '2026-08-29');
    assert.equal(nextBusinessDay('2026-08-29'), '2026-08-31');
  });
});

describe('deal log totals', () => {
  const deals = [
    { date: '2026-08-31', type: 'RETAIL', dept: 'New', frontGross: 100, backGross: 200, totalGross: 300 },
    { date: '2026-08-31', type: 'Retail', dept: 'USED', frontGross: 50, backGross: 75, totalGross: 125 },
    { date: '2026-08-31', type: 'Wholesale', dept: 'Used', frontGross: 999, backGross: 1, totalGross: 1000 },
    { date: '2026-08-31', type: 'Dealer Trade', dept: 'New', frontGross: 80, backGross: 0, totalGross: 80 },
    { date: '2026-08-01', type: 'RETAIL', dept: 'New', frontGross: 10, backGross: 20, totalGross: 30 }
  ];

  it('matches 8/31 deals entered as US dates even with empty padded rows', () => {
    const summary = summarizeDealLog(
      [
        { date: '8/31/2026', type: 'RETAIL', dept: 'New', frontGross: 100, backGross: 200 },
        { date: '8/31/26', type: 'Retail', dept: 'USED', frontGross: 50, backGross: 75 },
        { date: '', type: 'RETAIL', dept: 'New', frontGross: 9, backGross: 9 }
      ],
      '2026-08-31'
    );
    assert.equal(summary.daily.newSold, 1);
    assert.equal(summary.daily.usedSold, 1);
    assert.equal(summary.daily.dealCount, 2);
    assert.equal(summary.lastRetailDate, '2026-08-31');
  });

  it('ignores padded date-only rows after the last typed retail deal', () => {
    const summary = summarizeDealLog(
      [
        { date: '8/31/2026', type: 'RETAIL', dept: 'New', frontGross: 100, backGross: 200 },
        { date: '8/31/2026', type: 'Retail', dept: 'Used', frontGross: 50, backGross: 75 },
        { date: '9/1/2026', type: '', dept: '', frontGross: 0, backGross: 0 },
        { date: '9/2/2026', type: '', dept: '' }
      ],
      '2026-08-31'
    );
    assert.equal(summary.daily.dealCount, 2);
    assert.equal(summary.lastRetailDate, '2026-08-31');
  });

  it('finds the last typed deal without scanning the formula tail', () => {
    const rows = [];
    for (let i = 0; i < 788; i += 1) {
      rows.push(['RETAIL', 'New']);
    }
    for (let i = 0; i < 11200; i += 1) {
      rows.push(['', '']);
    }
    const scan = lastDealScanCellsRead(rows);
    assert.equal(lastFilledDealIndex(rows), 787);
    assert.equal(scan.found, 787);
    assert.ok(scan.cells < 1200, `expected a short TYPE scan, read ${scan.cells} cells`);
  });

  it('reads only the selected day’s rows from a date column', () => {
    const dates = ['2026-08-30', '2026-08-31', '2026-08-31', '2026-08-31', '', ''];
    assert.deepEqual(findDateSpan(dates, '2026-08-31'), { start: 1, end: 3 });
    assert.equal(findDateSpan(dates, '2026-09-01'), null);
  });

  it('counts only retail new and used for the selected day', () => {
    assert.equal(isRetailType('Retail'), true);
    const summary = summarizeDealLog(deals, '2026-08-31');
    assert.equal(summary.daily.newSold, 1);
    assert.equal(summary.daily.usedSold, 1);
    assert.equal(summary.daily.totalSold, 2);
    assert.equal(summary.daily.frontGross, 150);
    assert.equal(summary.daily.backGross, 275);
    assert.equal(summary.daily.totalGross, 425);
    assert.equal(summary.daily.dealCount, 2);
  });

  it('rolls retail deals into month-to-date', () => {
    const summary = summarizeDealLog(deals, '2026-08-31');
    assert.equal(summary.monthly.newSold, 2);
    assert.equal(summary.monthly.usedSold, 1);
    assert.equal(summary.monthly.totalGross, 455);
  });
});

describe('daily recap math', () => {
  it('sets total gross to front plus back and computes traffic rates', () => {
    const report = normalizeDailyReport({
      date: '2026-08-31',
      newSold: 5,
      usedSold: 2,
      frontGross: -3600.06,
      backGross: 14298.98,
      appointments: 14,
      shownAppointments: 10,
      showroomVisits: 19,
      nextDayAppointments: 8
    });
    assert.equal(report.totalSold, 7);
    assert.equal(report.totalGross, 10698.92);
    assert.equal(report.nextBusinessDate, '2026-09-01');
    assert.equal(report.metrics.showRate, 10 / 14);
    assert.equal(report.metrics.closeRate, 7 / 19);
    assert.equal(showRate(10, 14), 10 / 14);
    assert.equal(closeRate(7, 19), 7 / 19);
    assert.equal(formatPercent(0.5), '50.0%');
    assert.equal(showRate(1, 0), null);
  });

  it('sums saved days into month-to-date', () => {
    const reports = [
      normalizeDailyReport({ date: '2026-08-30', newSold: 1, usedSold: 1, frontGross: 100, backGross: 50 }),
      normalizeDailyReport({ date: '2026-08-31', newSold: 5, usedSold: 2, frontGross: 200, backGross: 80 }),
      normalizeDailyReport({ date: '2026-07-31', newSold: 9, usedSold: 9, frontGross: 999, backGross: 999 })
    ];
    const rollup = rollupReports(reports, '2026-08-31');
    assert.equal(rollup.daily.totalSold, 7);
    assert.equal(rollup.monthly.newSold, 6);
    assert.equal(rollup.monthly.usedSold, 3);
    assert.equal(rollup.monthly.totalGross, 430);
  });
});

describe('snapshot', () => {
  it('prefills unsaved days from the retail deal log', () => {
    const snapshot = buildDailySnapshot({
      dateKey: '2026-09-01',
      reports: [],
      dealLog: [
        { date: '2026-09-01', type: 'RETAIL', dept: 'Used', frontGross: 400, backGross: 600 }
      ]
    });
    assert.equal(snapshot.saved, false);
    assert.equal(snapshot.fromDealLog, true);
    assert.equal(snapshot.report.newSold, 0);
    assert.equal(snapshot.report.usedSold, 1);
    assert.equal(snapshot.report.totalGross, 1000);
    assert.equal(snapshot.report.appointments, 0);
    assert.equal(snapshot.source || snapshot.report.source, 'deal-log');
  });

  it('fills units and gross from DEALINPUT when the date is selected, and keeps saved traffic', () => {
    const saved = normalizeDailyReport({
      date: '2026-08-31',
      newSold: 5,
      usedSold: 2,
      frontGross: -3600.06,
      backGross: 14298.98,
      appointments: 14,
      shownAppointments: 10,
      showroomVisits: 19,
      nextDayAppointments: 8
    });
    const snapshot = buildDailySnapshot({
      dateKey: '2026-08-31',
      reports: [saved],
      dealLog: [
        { date: '2026-08-31', type: 'RETAIL', dept: 'New', frontGross: 100, backGross: 200 },
        { date: '2026-08-31', type: 'RETAIL', dept: 'Used', frontGross: 50, backGross: 75 }
      ]
    });
    assert.equal(snapshot.saved, true);
    assert.equal(snapshot.fromDealLog, true);
    assert.equal(snapshot.report.newSold, 1);
    assert.equal(snapshot.report.usedSold, 1);
    assert.equal(snapshot.report.frontGross, 150);
    assert.equal(snapshot.report.backGross, 275);
    assert.equal(snapshot.report.totalGross, 425);
    assert.equal(snapshot.report.appointments, 14);
    assert.equal(snapshot.report.shownAppointments, 10);
    assert.equal(snapshot.report.showroomVisits, 19);
    assert.equal(snapshot.report.nextDayAppointments, 8);
  });

  it('keeps saved units when DEALINPUT has no retail deals for that date', () => {
    const saved = normalizeDailyReport({
      date: '2026-09-01',
      newSold: 3,
      usedSold: 2,
      frontGross: 1500,
      backGross: 3200,
      appointments: 12
    });
    const snapshot = buildDailySnapshot({
      dateKey: '2026-09-01',
      reports: [saved],
      dealLog: []
    });
    assert.equal(snapshot.fromDealLog, false);
    assert.equal(snapshot.report.newSold, 3);
    assert.equal(snapshot.report.usedSold, 2);
    assert.equal(snapshot.report.totalGross, 4700);
    assert.equal(snapshot.report.appointments, 12);
  });
});

describe('sheet safety', () => {
  it('refuses to collide with DEALINPUT, SUMMARY, and the service manager tabs', () => {
    const audit = auditWorkbook({
      sheetNames: ['HOME', 'SUMMARY', 'DEALINPUT', 'SMR_Dashboard', 'SLM_Daily'],
      functionNames: ['onOpen', 'SLM_onOpen']
    });
    assert.equal(audit.safeToInstall, true);
    assert.ok(reservedSheetNames().every((name) => name.startsWith('SLM_')));
    assert.ok(reservedSimpleTriggers().includes('onOpen'));
    assert.ok(audit.protectedHits.includes('DEALINPUT'));
    assert.ok(audit.protectedHits.includes('SMR_Dashboard'));
    const trigger = audit.collisions.find((row) => row.name === 'onOpen');
    assert.equal(trigger.severity, 'keep');
  });
});
