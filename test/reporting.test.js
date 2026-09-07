import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHeatTransition,
  auditWorkbook,
  buildDailySnapshot,
  computeEfficiency,
  computeProduction,
  formatPercent,
  heatAssignment,
  mergeHoursWithRoster,
  mondayOfWeek,
  monthKey,
  nextHeatCaseId,
  payrollWeekRange,
  rollupRepairOrders,
  rollupWeekHours,
  soldWeekRange,
  roundHours,
  sumRepairOrders,
  reservedSheetNames,
  reservedSimpleTriggers,
  rollupGross,
  sumTechHours,
  toDateKey
} from '../src/reporting.js';

describe('date helpers', () => {
  it('keeps ISO date keys and derives months', () => {
    assert.equal(toDateKey('2026-08-29'), '2026-08-29');
    assert.equal(monthKey('2026-08-29'), '2026-08');
  });

  it('builds sold Mon–Fri and payroll last-Tuesday-through-Monday ranges', () => {
    assert.equal(mondayOfWeek('2026-08-29'), '2026-08-24');
    assert.deepEqual(soldWeekRange('2026-08-29'), {
      start: '2026-08-24',
      end: '2026-08-28',
      mode: 'sold',
      field: 'soldHours',
      label: 'Sold week (Mon–Fri)'
    });
    assert.deepEqual(payrollWeekRange('2026-08-29'), {
      start: '2026-08-18',
      end: '2026-08-24',
      mode: 'payroll',
      field: 'clockHours',
      label: 'Payroll week (Tue–Mon)'
    });
    assert.equal(mondayOfWeek('2026-08-24'), '2026-08-24');
    assert.equal(mondayOfWeek('2026-08-23'), '2026-08-17');
  });
});

describe('week hours', () => {
  it('sums sold hours Mon–Fri and payroll clock hours Tue–Mon', () => {
    const rows = [
      { date: '2026-08-24', techName: 'BIG AL', clockHours: 8, soldHours: 10 },
      { date: '2026-08-28', techName: 'BIG AL', clockHours: 8, soldHours: 5 },
      { date: '2026-08-29', techName: 'BIG AL', clockHours: 8, soldHours: 9 },
      { date: '2026-08-18', techName: 'BIG AL', clockHours: 8, soldHours: 1 },
      { date: '2026-08-25', techName: 'BIG AL', clockHours: 8, soldHours: 4 }
    ];
    const sold = rollupWeekHours(rows, '2026-08-29', 'sold');
    assert.equal(sold.total, 19);
    assert.equal(sold.rows[0].hours, 19);
    const payroll = rollupWeekHours(rows, '2026-08-29', 'payroll');
    assert.equal(payroll.total, 16);
    assert.equal(payroll.start, '2026-08-18');
    assert.equal(payroll.end, '2026-08-24');
  });
});

describe('tech hours', () => {
  it('sums clock and sold hours and computes efficiency', () => {
    const totals = sumTechHours([
      { clockHours: 8, soldHours: 9 },
      { clockHours: '8', soldHours: '7.2' }
    ]);
    assert.equal(totals.clockHours, 16);
    assert.equal(totals.soldHours, 16.2);
    assert.equal(computeEfficiency(16.2, 16), 1.0125);
    assert.equal(formatPercent(1), '100.0%');
    assert.equal(computeEfficiency(5, 0), null);
    assert.equal(roundHours(3.9 + 3.7 + 1 + 11.4 + 8.6 + 8.2 + 4.8), 41.6);
  });
});

describe('RO totals', () => {
  it('sums open, closed, and written counts from technician lines', () => {
    const totals = sumRepairOrders([
      { openCount: 2, closedCount: 1, writtenCount: 3 },
      { openCount: 4, closedCount: 2, writtenCount: 1 }
    ]);
    assert.equal(totals.openCount, 6);
    assert.equal(totals.closedCount, 3);
    assert.equal(totals.writtenCount, 4);
  });

  it('rolls store open, opened today, closed today, and MTD totals', () => {
    const rollup = rollupRepairOrders([
      { date: '2026-08-01', openCount: 40, writtenCount: 10, closedCount: 8 },
      { date: '2026-08-29', openCount: 36, openedCount: 12, closedCount: 16 },
      { date: '2026-07-31', openCount: 50, writtenCount: 9, closedCount: 9 }
    ], '2026-08-29');
    assert.equal(rollup.openCount, 36);
    assert.equal(rollup.openedCount, 12);
    assert.equal(rollup.closedCount, 16);
    assert.equal(rollup.monthly.openCount, 36);
    assert.equal(rollup.monthly.openedCount, 22);
    assert.equal(rollup.monthly.closedCount, 24);
    const early = rollupRepairOrders([
      { date: '2026-08-01', openCount: 40, writtenCount: 10, closedCount: 8 },
      { date: '2026-08-29', openCount: 36, openedCount: 12, closedCount: 16 }
    ], '2026-08-01');
    assert.equal(early.openCount, 40);
    assert.equal(early.monthly.openedCount, 10);
    assert.equal(early.monthly.closedCount, 8);
  });
});

describe('gross rollup', () => {
  const entries = [
    { period: 'daily', date: '2026-08-01', laborGross: 1000, partsGross: 400, otherGross: 50 },
    { period: 'daily', date: '2026-08-29', laborGross: 2000, partsGross: 800, otherGross: 100 }
  ];

  it('sums daily entries for the month when no override exists', () => {
    const rollup = rollupGross(entries, '2026-08-29');
    assert.equal(rollup.daily.totalGross, 2100);
    assert.equal(rollup.monthly.totalGross, 3150);
    assert.equal(rollup.monthly.source, 'daily-sum');
  });

  it('uses an explicit monthly override when present', () => {
    const rollup = rollupGross(
      [...entries, { period: 'monthly', month: '2026-08', date: '2026-08-01', laborGross: 50000, partsGross: 20000, otherGross: 0 }],
      '2026-08-29'
    );
    assert.equal(rollup.monthly.totalGross, 50000);
    assert.equal(rollup.monthly.source, 'override');
  });
});

describe('roster hours', () => {
  it('fills every roster tech without asking for a name', () => {
    const merged = mergeHoursWithRoster(
      [{ techName: 'HEAVY-C', clockHours: 8, soldHours: 13 }],
      ['BIG AL', 'HEAVY-C', 'LIL-J']
    );
    assert.equal(merged.length, 3);
    assert.equal(merged[0].techName, 'BIG AL');
    assert.equal(merged[0].clockHours, 8);
    assert.equal(merged[1].soldHours, 13);
    assert.equal(merged[2].techName, 'LIL-J');
  });
});

describe('heat cases', () => {
  it('allocates sequential ids for the same day', () => {
    const id = nextHeatCaseId([{ id: 'HEAT-20260829-001' }, { id: 'HEAT-20260829-003' }], '2026-08-29');
    assert.equal(id, 'HEAT-20260829-004');
  });

  it('records briefed and resolved timestamps', () => {
    const opened = { id: 'HEAT-1', status: 'open', briefedAt: '', resolvedAt: '', resolutionNotes: '' };
    const briefed = applyHeatTransition(opened, 'brief', '2026-08-29T12:00:00.000Z');
    assert.equal(briefed.status, 'briefed');
    assert.equal(briefed.briefedAt, '2026-08-29T12:00:00.000Z');
    const resolved = applyHeatTransition(briefed, 'resolve', '2026-08-29T18:00:00.000Z', 'Customer called. Loaner provided.');
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.resolvedAt, '2026-08-29T18:00:00.000Z');
    assert.match(resolved.resolutionNotes, /Loaner/);
  });

  it('refuses to mark a resolved case as briefed', () => {
    assert.throws(() => applyHeatTransition({ status: 'resolved' }, 'brief', 't'));
  });

  it('stores assigned advisor and technician, keeping owner as the advisor', () => {
    const assigned = heatAssignment({ advisor: 'Cody Raffary', technician: 'BIG AL', owner: 'ignored' });
    assert.equal(assigned.advisor, 'Cody Raffary');
    assert.equal(assigned.technician, 'BIG AL');
    assert.equal(assigned.owner, 'Cody Raffary');
    const fromOwner = heatAssignment({ owner: 'Cody Raffary' });
    assert.equal(fromOwner.advisor, 'Cody Raffary');
    assert.equal(fromOwner.technician, '');
  });
});

describe('production board', () => {
  it('computes sold hours, ELR, hours per RO, and unapplied time', () => {
    const production = computeProduction({
      soldHours: 40,
      clockHours: 48,
      laborGross: 6200,
      closedCount: 16
    });
    assert.equal(production.soldHours, 40);
    assert.equal(production.elr, 155);
    assert.equal(production.hoursPerRo, 2.5);
    assert.equal(production.unappliedHours, 8);
    assert.equal(computeProduction({ soldHours: 10, clockHours: 8, laborGross: 0, closedCount: 0 }).hoursPerRo, null);
    assert.equal(computeProduction({ soldHours: 0, clockHours: 8, laborGross: 100, closedCount: 4 }).elr, null);
  });
});

describe('daily snapshot', () => {
  it('recalls hours, week hours, and open heat cases for one day', () => {
    const snapshot = buildDailySnapshot({
      dateKey: '2026-08-29',
      techHours: [
        { date: '2026-08-29', techName: 'Alex', clockHours: 8, soldHours: 8, openCount: 3, closedCount: 2, writtenCount: 1 },
        { date: '2026-08-28', techName: 'Alex', clockHours: 8, soldHours: 9 }
      ],
      grossEntries: [{ period: 'daily', date: '2026-08-29', laborGross: 100, partsGross: 50, otherGross: 0 }],
      repairOrders: [{ date: '2026-08-29', openCount: 99, closedCount: 99, writtenCount: 99 }],
      heatCases: [
        { openedDate: '2026-08-28', status: 'open', severity: 'critical' },
        { openedDate: '2026-08-25', status: 'resolved', severity: 'low', resolvedAt: '2026-08-29T11:00:00.000Z' }
      ]
    });
    assert.equal(snapshot.techHours.lineCount, 1);
    assert.equal(snapshot.repairOrders.openCount, 99);
    assert.equal(snapshot.repairOrders.openedCount, 99);
    assert.equal(snapshot.repairOrders.closedCount, 99);
    assert.equal(snapshot.repairOrders.writtenCount, 99);
    assert.equal(snapshot.repairOrders.monthly.openedCount, 99);
    assert.equal(snapshot.repairOrders.monthly.closedCount, 99);
    assert.equal(snapshot.heatCases.openCount, 1);
    assert.equal(snapshot.heatCases.resolvedTodayCount, 1);
    assert.equal(snapshot.heatCases.criticalCount, 1);
    assert.equal(snapshot.weekHours.sold.total, 9);
    assert.equal(snapshot.weekHours.payroll.total, 0);
  });

  it('uses shop-wide closed ROs for Hours / RO on the production board', () => {
    const snapshot = buildDailySnapshot({
      dateKey: '2026-08-29',
      techHours: [
        { date: '2026-08-29', techName: 'BIG AL', clockHours: 8, soldHours: 10 },
        { date: '2026-08-29', techName: 'LIL-J', clockHours: 8, soldHours: 6 }
      ],
      grossEntries: [{ period: 'daily', date: '2026-08-29', laborGross: 2480, partsGross: 0, otherGross: 50 }],
      repairOrders: [{ date: '2026-08-29', closedCount: 8 }]
    });
    assert.equal(snapshot.production.soldHours, 16);
    assert.equal(snapshot.production.elr, 155);
    assert.equal(snapshot.production.hoursPerRo, 2);
    assert.equal(snapshot.production.unappliedHours, 0);
    assert.equal(snapshot.production.closedCount, 8);
  });
});

describe('compatibility contract', () => {
  it('never claims reserved simple trigger names', () => {
    assert.deepEqual(reservedSimpleTriggers(), ['onOpen', 'onEdit', 'onInstall', 'onSelectionChange', 'onChange', 'doGet', 'doPost']);
    for (const name of reservedSheetNames()) {
      assert.match(name, /^SMR_/);
    }
  });

  it('treats existing non-SMR sheets as preserved', () => {
    const audit = auditWorkbook({
      sheetNames: ['Advisor Log', 'Hours', 'SMR_Dashboard'],
      functionNames: ['onOpen', 'refreshLog']
    });
    assert.equal(audit.safeToInstall, true);
    assert.deepEqual(audit.existingNonSmrSheets, ['Advisor Log', 'Hours']);
    assert.ok(audit.collisions.some((item) => item.name === 'onOpen' && item.severity === 'keep'));
  });

  it('marks live Geaux service tabs as protected', () => {
    const audit = auditWorkbook({
      sheetNames: ['HOME', 'SERVICE BOARD', 'SVC_RO', 'SMR_TechHours']
    });
    assert.equal(audit.safeToInstall, true);
    assert.deepEqual(audit.protectedHits, ['HOME', 'SERVICE BOARD', 'SVC_RO']);
    assert.ok(audit.collisions.every((item) => item.severity !== 'block'));
  });
});
