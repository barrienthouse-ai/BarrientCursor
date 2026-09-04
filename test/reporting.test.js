import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditWorkbook,
  buildDailySnapshot,
  expectedDeliveriesFromPipeline,
  formatPercent,
  geauxProtectedSheetNames,
  goalPace,
  grossPerUnit,
  isFleetDeal,
  monthKey,
  nextBusinessDay,
  nextWorkingDealId,
  normalizeDailyReport,
  normalizeMonthlyGoal,
  overlayMonthToDate,
  parseSheetDateKey,
  reservedSheetNames,
  reservedSimpleTriggers,
  rollupReports,
  summarizeFleetDealLog,
  toDateKey,
  workingDealSummary
} from '../src/reporting.js';

describe('date helpers', () => {
  it('keeps ISO date keys and derives months', () => {
    assert.equal(toDateKey('2026-09-04'), '2026-09-04');
    assert.equal(monthKey('2026-09-04'), '2026-09');
  });

  it('parses DEALINPUT date formats used on the live sheet', () => {
    assert.equal(parseSheetDateKey('9/4/2026'), '2026-09-04');
    assert.equal(parseSheetDateKey('09/04/26'), '2026-09-04');
    assert.equal(toDateKey('9/4/2026'), '2026-09-04');
  });

  it('skips Sunday when finding the next business day', () => {
    assert.equal(nextBusinessDay('2026-09-04'), '2026-09-05');
    assert.equal(nextBusinessDay('2026-09-05'), '2026-09-07');
  });
});

describe('fleet deal log', () => {
  const deals = [
    { date: '2026-09-04', type: 'FLEET', dept: 'New', frontGross: 3120, financeGross: 1680, unit: 6 },
    { date: '2026-09-04', type: 'Retail', dept: 'New', frontGross: 100, financeGross: 200, unit: 1 },
    { date: '2026-09-03', type: 'Commercial', dept: 'New', frontGross: 2480, financeGross: 1100, unit: 4 },
    { date: '2026-09-03', type: 'FLEET', dept: 'Used', frontGross: 620, financeGross: 380, unit: 1 },
    { date: '2026-09-01', type: 'Wholesale', dept: 'Used', frontGross: 999, financeGross: 0, unit: 1 }
  ];

  it('counts only Fleet and Commercial rows', () => {
    assert.equal(isFleetDeal({ type: 'FLEET', dept: 'New' }), true);
    assert.equal(isFleetDeal({ type: 'Retail', dept: 'Fleet' }), true);
    assert.equal(isFleetDeal({ type: 'RETAIL', dept: 'New' }), false);
    const summary = summarizeFleetDealLog(deals, '2026-09-04');
    assert.equal(summary.daily.soldDeals, 6);
    assert.equal(summary.daily.dealCount, 1);
    assert.equal(summary.daily.frontGross, 3120);
    assert.equal(summary.daily.financeGross, 1680);
    assert.equal(summary.daily.totalGross, 4800);
    assert.equal(summary.monthly.soldDeals, 11);
    assert.equal(summary.lastFleetDate, '2026-09-04');
  });

  it('accepts US dates on fleet rows', () => {
    const summary = summarizeFleetDealLog(
      [{ date: '9/4/2026', type: 'Fleet', dept: 'New', frontGross: 100, financeGross: 50, unit: 2 }],
      '2026-09-04'
    );
    assert.equal(summary.daily.soldDeals, 2);
    assert.equal(summary.daily.totalGross, 150);
  });
});

describe('gross per unit and goals', () => {
  it('divides total gross by sold units', () => {
    assert.equal(grossPerUnit(4800, 6), 800);
    assert.equal(grossPerUnit(100, 0), null);
    assert.equal(goalPace(16, 40), 0.4);
    assert.equal(goalPace(16, 0), null);
    assert.equal(formatPercent(0.4), '40.0%');
  });

  it('normalizes a daily recap and totals front plus finance', () => {
    const report = normalizeDailyReport({
      date: '2026-09-04',
      soldDeals: 6,
      workingDeals: 8,
      frontGross: 3120,
      financeGross: 1680,
      deliveries: 5,
      courtesyDeliveries: 1,
      expectedDeliveries: 13
    });
    assert.equal(report.totalGross, 4800);
    assert.equal(report.metrics.gpu, 800);
    assert.equal(report.month, '2026-09');
  });

  it('stores a monthly unit and gross goal', () => {
    const goal = normalizeMonthlyGoal({ month: '2026-09', unitGoal: 40, grossGoal: 48000 });
    assert.equal(goal.unitGoal, 40);
    assert.equal(goal.grossGoal, 48000);
  });
});

describe('working deals', () => {
  const deals = [
    { id: 'FLM-20260902-001', openedDate: '2026-09-02', status: 'working', units: 4, expectedDelivery: '2026-09-08' },
    { id: 'FLM-20260903-001', openedDate: '2026-09-03', status: 'sold', units: 3, expectedDelivery: '2026-09-04' },
    { id: 'FLM-20260828-001', openedDate: '2026-08-28', status: 'delivered', units: 1, expectedDelivery: '2026-09-03', updatedAt: '2026-09-03T18:00:00.000Z' },
    { id: 'FLM-20260901-002', openedDate: '2026-09-01', status: 'dead', units: 2, expectedDelivery: '2026-09-15' }
  ];

  it('counts open pipeline units and expected deliveries', () => {
    const summary = workingDealSummary(deals, '2026-09-04');
    assert.equal(summary.openCount, 2);
    assert.equal(summary.workingCount, 1);
    assert.equal(summary.soldOpenCount, 1);
    assert.equal(summary.openUnits, 7);
    assert.equal(summary.expectedUnits, 7);
    assert.equal(summary.expectedTodayUnits, 3);
    assert.equal(expectedDeliveriesFromPipeline(summary, ''), 7);
    assert.equal(expectedDeliveriesFromPipeline(summary, 13), 13);
  });

  it('sequences new working deal ids for the report date', () => {
    assert.equal(nextWorkingDealId(deals, '2026-09-03'), 'FLM-20260903-002');
    assert.equal(nextWorkingDealId([], '2026-09-04'), 'FLM-20260904-001');
  });
});

describe('month-to-date rollup', () => {
  const reports = [
    { date: '2026-09-01', soldDeals: 3, frontGross: 1840, financeGross: 960, totalGross: 2800, deliveries: 2, courtesyDeliveries: 1, expectedDeliveries: 11, workingDeals: 8 },
    { date: '2026-09-02', soldDeals: 2, frontGross: 1260, financeGross: 540, totalGross: 1800, deliveries: 3, courtesyDeliveries: 0, expectedDeliveries: 12, workingDeals: 9 },
    { date: '2026-08-31', soldDeals: 4, frontGross: 900, financeGross: 100, totalGross: 1000, deliveries: 4, courtesyDeliveries: 1, expectedDeliveries: 4, workingDeals: 5 }
  ];

  it('sums September only and keeps prior days separate from today', () => {
    const rollup = rollupReports(reports, '2026-09-02', { unitGoal: 40, grossGoal: 48000 });
    assert.equal(rollup.monthly.soldDeals, 5);
    assert.equal(rollup.monthly.frontGross, 3100);
    assert.equal(rollup.monthly.financeGross, 1500);
    assert.equal(rollup.monthly.totalGross, 4600);
    assert.equal(rollup.monthly.deliveries, 5);
    assert.equal(rollup.monthlyPrior.soldDeals, 3);
    assert.equal(rollup.monthly.metrics.gpu, 920);
  });

  it('overlays today on prior MTD for live goal pace', () => {
    const live = overlayMonthToDate(reports[0], {
      soldDeals: 6,
      frontGross: 3120,
      financeGross: 1680,
      totalGross: 4800,
      deliveries: 5,
      courtesyDeliveries: 1,
      expectedDeliveries: 13,
      workingDeals: 8
    }, { unitGoal: 40, grossGoal: 48000 });
    assert.equal(live.soldDeals, 9);
    assert.equal(live.frontGross, 4960);
    assert.equal(live.totalGross, 7600);
    assert.equal(live.metrics.unitPace, 9 / 40);
  });
});

describe('daily snapshot', () => {
  it('fills sold units and gross from the fleet deal log until saved', () => {
    const snapshot = buildDailySnapshot({
      dateKey: '2026-09-04',
      reports: [],
      goals: [{ month: '2026-09', unitGoal: 40, grossGoal: 48000 }],
      workingDeals: [
        { openedDate: '2026-09-02', status: 'working', units: 4, expectedDelivery: '2026-09-08' },
        { openedDate: '2026-09-03', status: 'sold', units: 3, expectedDelivery: '2026-09-04' }
      ],
      dealLog: [
        { date: '2026-09-04', type: 'FLEET', dept: 'New', frontGross: 3120, financeGross: 1680, unit: 6 }
      ]
    });
    assert.equal(snapshot.fromDealLog, true);
    assert.equal(snapshot.report.soldDeals, 6);
    assert.equal(snapshot.report.frontGross, 3120);
    assert.equal(snapshot.report.financeGross, 1680);
    assert.equal(snapshot.report.totalGross, 4800);
    assert.equal(snapshot.report.workingDeals, 2);
    assert.equal(snapshot.expectedDeliveries.fromPipeline, 7);
    assert.equal(snapshot.metrics.gpu, 800);
    assert.equal(snapshot.goal.unitGoal, 40);
  });

  it('keeps a saved recap when DEALINPUT has no fleet rows that day', () => {
    const snapshot = buildDailySnapshot({
      dateKey: '2026-09-04',
      reports: [
        normalizeDailyReport({
          date: '2026-09-04',
          soldDeals: 6,
          workingDeals: 8,
          frontGross: 3120,
          financeGross: 1680,
          deliveries: 5,
          courtesyDeliveries: 1,
          expectedDeliveries: 13
        })
      ],
      goals: [{ month: '2026-09', unitGoal: 40, grossGoal: 48000 }],
      workingDeals: [],
      dealLog: [{ date: '2026-09-04', type: 'RETAIL', dept: 'New', frontGross: 10, financeGross: 20, unit: 1 }]
    });
    assert.equal(snapshot.saved, true);
    assert.equal(snapshot.fromDealLog, false);
    assert.equal(snapshot.report.soldDeals, 6);
    assert.equal(snapshot.report.deliveries, 5);
    assert.equal(snapshot.report.courtesyDeliveries, 1);
    assert.equal(snapshot.monthly.frontGross, 3120);
  });
});

describe('workbook safety', () => {
  it('writes only FLM_* tabs and leaves SalesLog, SMR, and SLM alone', () => {
    assert.deepEqual(reservedSheetNames(), ['FLM_Dashboard', 'FLM_Daily', 'FLM_Working', 'FLM_Goals', 'FLM_Config']);
    assert.ok(geauxProtectedSheetNames().includes('DEALINPUT'));
    assert.ok(geauxProtectedSheetNames().includes('FLEET CUSTOMERS'));
    assert.ok(geauxProtectedSheetNames().includes('SMR_Dashboard'));
    assert.ok(geauxProtectedSheetNames().includes('SLM_Daily'));
    const audit = auditWorkbook({
      sheetNames: ['HOME', 'SUMMARY', 'DEALINPUT', 'FLEET CUSTOMERS', 'SMR_Dashboard', 'SLM_Dashboard', 'FLM_Dashboard'],
      functionNames: ['onOpen', 'logDeal', 'FLM_onOpen']
    });
    assert.equal(audit.safeToInstall, true);
    assert.ok(audit.protectedHits.includes('DEALINPUT'));
    assert.ok(audit.protectedHits.includes('FLEET CUSTOMERS'));
    assert.ok(reservedSimpleTriggers().includes('doGet'));
  });
});
