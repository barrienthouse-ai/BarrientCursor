import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createStore, emptyStore } from '../src/store.js';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

describe('API', () => {
  let dir;
  let server;
  let base;

  before(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'flm-'));
    const filePath = path.join(dir, 'store.json');
    const seeded = emptyStore();
    seeded.dealLog = [
      { date: '2026-09-04', type: 'FLEET', dept: 'New', frontGross: 3120, financeGross: 1680, unit: 6 },
      { date: '2026-09-04', type: 'RETAIL', dept: 'New', frontGross: 5000, financeGross: 0, unit: 1 }
    ];
    seeded.goals = [{ month: '2026-09', unitGoal: 40, grossGoal: 48000 }];
    writeFileSync(filePath, JSON.stringify(seeded));
    const started = await listen(createApp(createStore(filePath)));
    server = started.server;
    base = started.base;
  });

  after(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    rmSync(dir, { recursive: true, force: true });
  });

  async function json(url, options) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    return { status: response.status, body: await response.json() };
  }

  it('reports health', async () => {
    const result = await json(`${base}/api/health`);
    assert.equal(result.status, 200);
    assert.equal(result.body.service, 'fleet-manager-report');
  });

  it('saves and recalls a fleet recap', async () => {
    const saved = await json(`${base}/api/daily-report`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-04',
        soldDeals: 6,
        workingDeals: 8,
        frontGross: 3120,
        financeGross: 1680,
        deliveries: 5,
        courtesyDeliveries: 1,
        expectedDeliveries: 13,
        notes: 'Parish dump trucks plus two courtesy drops.'
      })
    });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.saved, true);
    assert.equal(saved.body.report.soldDeals, 6);
    assert.equal(saved.body.report.totalGross, 4800);
    assert.equal(saved.body.report.metrics.gpu, 800);
    assert.equal(saved.body.monthly.frontGross, 3120);
    assert.equal(saved.body.goal.unitGoal, 40);

    const recalled = await json(`${base}/api/daily-report/2026-09-04`);
    assert.equal(recalled.body.fromDealLog, true);
    assert.equal(recalled.body.report.soldDeals, 6);
    assert.equal(recalled.body.report.deliveries, 5);
    assert.equal(recalled.body.report.courtesyDeliveries, 1);
    assert.match(recalled.body.report.notes, /Parish dump trucks/);
  });

  it('replaces the same date instead of duplicating it', async () => {
    await json(`${base}/api/daily-report`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-04',
        soldDeals: 7,
        workingDeals: 8,
        frontGross: 3500,
        financeGross: 1700,
        deliveries: 6,
        courtesyDeliveries: 2,
        expectedDeliveries: 14
      })
    });
    const history = await json(`${base}/api/history?from=2026-09-04&to=2026-09-04`);
    assert.equal(history.body.rows.length, 1);
    assert.equal(history.body.rows[0].soldDeals, 7);
    assert.equal(history.body.rows[0].totalGross, 5200);
  });

  it('fills sold units and gross from fleet DEALINPUT rows without touching deliveries', async () => {
    const filled = await json(`${base}/api/fill-from-deal-log`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-04',
        workingDeals: 8,
        deliveries: 6,
        courtesyDeliveries: 2,
        expectedDeliveries: 14
      })
    });
    assert.equal(filled.status, 200);
    assert.equal(filled.body.report.source, 'deal-log');
    assert.equal(filled.body.dealLog.daily.soldDeals, 6);
    assert.equal(filled.body.report.soldDeals, 6);
    assert.equal(filled.body.report.totalGross, 4800);
    assert.equal(filled.body.report.deliveries, 6);
    assert.equal(filled.body.report.courtesyDeliveries, 2);
  });

  it('tracks working deals through sold and delivered', async () => {
    const created = await json(`${base}/api/working-deals`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-04',
        customer: 'Dana Ruiz',
        account: 'Jefferson Parish',
        vehicle: '2026 Tahoe PPV',
        units: 3,
        frontGross: 1800,
        financeGross: 450,
        expectedDelivery: '2026-09-08'
      })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'working');
    assert.match(created.body.id, /^FLM-20260904-/);

    const sold = await json(`${base}/api/working-deals/${created.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'sold' })
    });
    assert.equal(sold.body.status, 'sold');

    const delivered = await json(`${base}/api/working-deals/${created.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'deliver' })
    });
    assert.equal(delivered.body.status, 'delivered');

    const open = await json(`${base}/api/working-deals?status=open`);
    assert.equal(open.body.rows.some((row) => row.id === created.body.id), false);
  });

  it('saves a monthly goal and exposes it on the snapshot', async () => {
    const saved = await json(`${base}/api/goals`, {
      method: 'POST',
      body: JSON.stringify({ month: '2026-09', unitGoal: 42, grossGoal: 50000, date: '2026-09-04' })
    });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.goal.unitGoal, 42);
    assert.equal(saved.body.snapshot.goal.grossGoal, 50000);
  });

  it('keeps DEALINPUT, FLEET CUSTOMERS, and the other briefings read-only', async () => {
    const audit = await json(`${base}/api/compatibility`);
    assert.equal(audit.body.safeToInstall, true);
    assert.ok(audit.body.protectedHits.includes('DEALINPUT'));
    assert.ok(audit.body.protectedHits.includes('FLEET CUSTOMERS'));
    assert.ok(audit.body.protectedHits.includes('SMR_Dashboard'));
    assert.ok(audit.body.protectedHits.includes('SLM_Dashboard'));
  });
});
