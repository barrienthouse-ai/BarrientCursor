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
    dir = mkdtempSync(path.join(tmpdir(), 'pmr-'));
    const filePath = path.join(dir, 'store.json');
    writeFileSync(filePath, JSON.stringify(emptyStore()));
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
    const body = await response.json();
    return { status: response.status, body };
  }

  it('identifies the parts manager service', async () => {
    const health = await json(`${base}/api/health`);
    assert.equal(health.body.service, 'parts-manager-report');
  });

  it('saves and recalls a full daily parts briefing', async () => {
    const saved = await json(`${base}/api/daily-report`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-05',
        inventoryValue: 521340,
        capitalLimit: 500000,
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
        rimCompliancePercent: 87,
        rimTargetPercent: 90,
        emergencyOrderCount: 5,
        emergencyFreightCost: 275,
        outstandingCoresValue: 2490,
        wholesaleStops: 14,
        hotshotRuns: 2,
        deliveryFuelCost: 141,
        notes: 'Friday close. N6M needs a GM return.'
      })
    });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.sales.totalSales, 23040);
    assert.equal(saved.body.capital.overCapital, true);
    assert.equal(saved.body.wait, 'crit');
    assert.equal(saved.body.rim.onTarget, false);
    assert.ok(saved.body.flags.alerts.some((item) => item.area === 'inventory'));

    const recalled = await json(`${base}/api/daily-report/2026-09-05`);
    assert.equal(recalled.body.report.inventoryValue, 521340);
    assert.match(recalled.body.report.notes, /N6M/);
  });

  it('tracks lost sales, SOP, backorders, and cores', async () => {
    const lost = await json(`${base}/api/lost-sales`, {
      method: 'POST',
      body: JSON.stringify({
        openedDate: '2026-09-05',
        partNumber: '19420472',
        description: 'BCM',
        requestedBy: 'Cody Raffary',
        timesRequested: 2,
        dollars: 485
      })
    });
    assert.equal(lost.status, 201);
    assert.match(lost.body.id, /^LSL-20260905-001$/);

    const again = await json(`${base}/api/lost-sales`, {
      method: 'POST',
      body: JSON.stringify({
        openedDate: '2026-09-05',
        partNumber: '19420472',
        description: 'BCM',
        timesRequested: 1,
        dollars: 485
      })
    });
    assert.equal(again.body.id, 'LSL-20260905-002');

    const sop = await json(`${base}/api/sop`, {
      method: 'POST',
      body: JSON.stringify({
        receivedDate: '2026-08-20',
        partNumber: '84710922',
        customer: 'Maria Delgado',
        roNumber: 'RO-44118',
        dollars: 890
      })
    });
    assert.equal(sop.body.status, 'rec');
    assert.ok(sop.body.ageDays >= 14);

    const bo = await json(`${base}/api/backorders`, {
      method: 'POST',
      body: JSON.stringify({
        openedDate: '2026-09-05',
        partNumber: '24294977',
        reason: 'stop-sale / body shop',
        vehicle: 'Silverado in body',
        severity: 'critical'
      })
    });
    assert.equal(bo.body.severity, 'critical');

    const core = await json(`${base}/api/cores`, {
      method: 'POST',
      body: JSON.stringify({
        openedDate: '2026-08-22',
        partNumber: '84008048',
        accountOrTech: 'HEAVY-C',
        dollars: 145
      })
    });
    assert.equal(core.body.status, 'outstanding');

    const stocked = await json(`${base}/api/lost-sales/${lost.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'stock' })
    });
    assert.equal(stocked.body.status, 'stocked');

    const returned = await json(`${base}/api/cores/${core.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'return', notes: 'On the GM core truck' })
    });
    assert.equal(returned.body.status, 'returned');

    const summary = await json(`${base}/api/summary?date=2026-09-05`);
    assert.ok(summary.body.lostSales.repeats.length >= 1);
    assert.equal(summary.body.sop.agedCount, 1);
    assert.equal(summary.body.backorders.criticalCount, 1);
  });

  it('rejects a lost sale without a part number', async () => {
    const result = await json(`${base}/api/lost-sales`, {
      method: 'POST',
      body: JSON.stringify({ description: 'No part' })
    });
    assert.equal(result.status, 400);
  });

  it('previews a GM recap without sending mail locally', async () => {
    const result = await json(`${base}/api/email-report`, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-05', inventoryValue: 521340, notes: 'GM recap test' })
    });
    assert.equal(result.body.saved, true);
    assert.equal(result.body.sent, false);
    assert.match(result.body.subject, /parts recap/);
    assert.match(result.body.html, /GEAUX CHEVROLET/);
  });

  it('serves the Sheet briefing layout', async () => {
    const response = await fetch(`${base}/sheet-briefing?date=2026-09-05`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Parts Manager Report/);
    assert.match(html, /True dollar value/);
    assert.match(html, /GM RIM/);
    assert.match(html, /var SEED = /);
  });
});
