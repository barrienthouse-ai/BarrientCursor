import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CDK_CODES,
  THRESHOLDS,
  applyBoardAction,
  auditWorkbook,
  buildAlerts,
  buildDailySnapshot,
  capitalHealth,
  daysBetween,
  formatMoney,
  lostSalesSummary,
  nextItemId,
  normalizeDailyReport,
  reservedSheetNames,
  rimStatus,
  salesTotals,
  sopAgeStatus,
  sopSummary,
  toDateKey,
  waitStatus
} from '../src/reporting.js';

describe('date helpers', () => {
  it('keeps ISO date keys and counts SOP age', () => {
    assert.equal(toDateKey('2026-09-05'), '2026-09-05');
    assert.equal(daysBetween('2026-08-20', '2026-09-05'), 16);
    assert.equal(sopAgeStatus(16), 'crit');
    assert.equal(sopAgeStatus(8), 'warn');
    assert.equal(sopAgeStatus(3), 'ok');
  });
});

describe('capital and RIM', () => {
  it('flags inventory over the monthly capital limit', () => {
    const health = capitalHealth({
      inventoryValue: 521340,
      capitalLimit: 500000,
      n3mValue: 36220,
      n6mValue: 48150,
      overstockValue: 40110
    });
    assert.equal(health.overCapital, true);
    assert.equal(health.variance, 21340);
    assert.ok(health.n6mShare > 0.09);
    assert.equal(formatMoney(health.variance), '$21,340.00');
  });

  it('measures GM RIM gap versus target', () => {
    const rim = rimStatus(86.1, 90);
    assert.equal(rim.onTarget, false);
    assert.equal(rim.gap, 3.9);
    assert.equal(rimStatus(91, 90).onTarget, true);
  });
});

describe('service drive flags', () => {
  it('treats 5–7 minute counter waits as the efficiency line', () => {
    assert.equal(waitStatus(4), 'ok');
    assert.equal(waitStatus(6), 'warn');
    assert.equal(waitStatus(8), 'crit');
    assert.equal(THRESHOLDS.waitCritMinutes, 7);
  });
});

describe('sales and daily normalize', () => {
  it('sums retail, wholesale, and internal parts sales', () => {
    const sales = salesTotals({ retailSales: 100, wholesaleSales: '50', internalSales: 25 });
    assert.equal(sales.totalSales, 175);
    const report = normalizeDailyReport({ date: '2026-09-05', inventoryValue: '521,340' });
    assert.equal(report.inventoryValue, 521340);
    assert.equal(report.capitalLimit, THRESHOLDS.capitalDefaultLimit);
    assert.equal(report.rimTargetPercent, 90);
  });
});

describe('lost sales and SOP boards', () => {
  it('spots repeat LSL part numbers in the last week', () => {
    const summary = lostSalesSummary([
      { openedDate: '2026-09-03', partNumber: '19420472', timesRequested: 2, dollars: 485, status: 'open' },
      { openedDate: '2026-09-04', partNumber: '19420472', timesRequested: 1, dollars: 485, status: 'open' },
      { openedDate: '2026-09-04', partNumber: '84732459', timesRequested: 1, dollars: 320, status: 'open' }
    ], '2026-09-05');
    assert.equal(summary.repeats[0].partNumber, '19420472');
    assert.equal(summary.repeats[0].hits, 3);
    assert.equal(summary.openCount, 3);
  });

  it('ages REC special orders against the 14-day non-returnable line', () => {
    const summary = sopSummary([
      { receivedDate: '2026-08-20', status: 'rec', dollars: 890 },
      { receivedDate: '2026-09-02', status: 'rec', dollars: 275 },
      { receivedDate: '2026-08-01', status: 'installed', dollars: 100 }
    ], '2026-09-05');
    assert.equal(summary.recCount, 2);
    assert.equal(summary.agedCount, 1);
    assert.equal(summary.agedValue, 890);
  });

  it('installs, returns, and restocks board items', () => {
    const installed = applyBoardAction({ kind: 'sop', status: 'rec' }, 'install', '2026-09-05T12:00:00.000Z');
    assert.equal(installed.status, 'installed');
    const core = applyBoardAction({ kind: 'core', status: 'outstanding' }, 'return', '2026-09-05T12:00:00.000Z', 'Credited');
    assert.equal(core.status, 'returned');
    assert.equal(core.resolutionNotes, 'Credited');
    const id = nextItemId('LSL', [{ id: 'LSL-20260905-001' }], '2026-09-05');
    assert.equal(id, 'LSL-20260905-002');
  });
});

describe('daily snapshot alerts', () => {
  it('builds GM flags from over-capital, wait, RIM, SOP, and cores', () => {
    const snapshot = buildDailySnapshot({
      dateKey: '2026-09-05',
      reports: [normalizeDailyReport({
        date: '2026-09-05',
        inventoryValue: 521340,
        capitalLimit: 500000,
        n6mValue: 48150,
        n3mValue: 36220,
        overstockValue: 40110,
        counterWaitMinutes: 8,
        lostSalesDollars: 980,
        emergencyOrderCount: 6,
        emergencyFreightCost: 340,
        rimCompliancePercent: 86.1,
        outstandingCoresValue: 2490
      })],
      lostSales: [
        { openedDate: '2026-09-03', partNumber: '19420472', timesRequested: 2, dollars: 485, status: 'open' },
        { openedDate: '2026-09-04', partNumber: '19420472', timesRequested: 1, dollars: 485, status: 'open' }
      ],
      sopItems: [{ receivedDate: '2026-08-20', status: 'rec', dollars: 890, partNumber: '84710922' }],
      backorders: [{ status: 'open', severity: 'critical', reason: 'stop-sale / body shop', partNumber: '24294977' }],
      cores: [{ status: 'outstanding', dollars: 1250, openedDate: '2026-08-22', daysOutstanding: 16 }]
    });
    assert.equal(snapshot.reported, true);
    assert.equal(snapshot.capital.overCapital, true);
    assert.equal(snapshot.wait, 'crit');
    assert.equal(snapshot.sop.agedCount, 1);
    assert.ok(snapshot.flags.critCount >= 3);
    const areas = snapshot.flags.alerts.map((item) => item.area);
    assert.ok(areas.includes('inventory'));
    assert.ok(areas.includes('counter'));
    assert.ok(areas.includes('sop'));
    assert.equal(CDK_CODES.inventory.code, 'MGR → INV');
    assert.equal(buildAlerts({}).ok, true);
  });
});

describe('workbook safety', () => {
  it('never claims existing Geaux, sales, service, or fleet tabs', () => {
    const names = reservedSheetNames();
    assert.ok(names.every((name) => name.startsWith('PMR_')));
    const audit = auditWorkbook({
      sheetNames: ['HOME', 'PARTS_TICKETS', 'SMR_Dashboard', 'SLM_Daily', 'FLM_Working', 'PMR_Daily'],
      functionNames: ['onOpen', 'PMR_onOpen']
    });
    assert.equal(audit.safeToInstall, true);
    assert.ok(audit.protectedHits.includes('PARTS_TICKETS'));
    assert.ok(audit.protectedHits.includes('SMR_Dashboard'));
    assert.ok(audit.collisions.some((item) => item.name === 'onOpen' && item.severity === 'keep'));
  });
});
