import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createStore, emptyStore } from '../src/store.js';
import { writeFileSync } from 'node:fs';

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
    dir = mkdtempSync(path.join(tmpdir(), 'smr-'));
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
    return { status: response.status, body: await response.json() };
  }

  it('saves and recalls a full daily report', async () => {
    const saved = await json(`${base}/api/daily-report`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-08-29',
        techHours: {
          rows: [
            { techName: 'Alex Rivera', clockHours: 8, soldHours: 8.5, openCount: 4, closedCount: 2, writtenCount: 3 },
            { techName: 'Jordan Hale', clockHours: 8, soldHours: 7, openCount: 5, closedCount: 1, writtenCount: 2 }
          ]
        },
        gross: { laborGross: 3000, otherGross: 100 },
        repairOrders: { closedCount: 5 }
      })
    });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.techHours.soldHours, 15.5);
    assert.equal(saved.body.production.soldHours, 15.5);
    assert.equal(saved.body.production.elr, 193.55);
    assert.equal(saved.body.production.hoursPerRo, 3.1);
    assert.equal(saved.body.production.unappliedHours, 0.5);
    assert.equal(saved.body.production.closedCount, 5);
    assert.equal(saved.body.weekHours.sold.start, '2026-08-24');
    assert.equal(saved.body.weekHours.sold.end, '2026-08-28');
    assert.equal(saved.body.weekHours.sold.total, 0);
    assert.equal(saved.body.weekHours.payroll.start, '2026-08-18');
    assert.equal(saved.body.weekHours.payroll.end, '2026-08-24');
    assert.equal(saved.body.weekHours.payroll.total, 0);

    const recalled = await json(`${base}/api/daily-report/2026-08-29`);
    assert.equal(recalled.body.techHours.rows.length, 2);
    assert.equal(recalled.body.gross.daily.totalGross, 3100);
    assert.equal(recalled.body.gross.daily.partsGross, 0);

    const hours = await json(`${base}/api/tech-hours?date=2026-08-29`);
    assert.equal(hours.body.rows[0].techName, 'Alex Rivera');
  });

  it('tracks heat case briefing and resolution', async () => {
    const openedDate = new Date().toISOString().slice(0, 10);
    const created = await json(`${base}/api/heat-cases`, {
      method: 'POST',
      body: JSON.stringify({
        openedDate,
        customer: 'Test Customer',
        advisor: 'Cody Raffary',
        technician: 'BIG AL',
        roNumber: 'RO-100',
        issue: 'Comeback on brakes',
        severity: 'high'
      })
    });
    assert.equal(created.status, 201);
    assert.match(created.body.id, /^HEAT-\d{8}-001$/);
    assert.equal(created.body.status, 'open');
    assert.equal(created.body.customer, 'Test Customer');
    assert.equal(created.body.advisor, 'Cody Raffary');
    assert.equal(created.body.technician, 'BIG AL');

    const listed = await json(`${base}/api/heat-cases`);
    const saved = listed.body.rows.find((row) => row.id === created.body.id);
    assert.equal(saved.customer, 'Test Customer');
    assert.equal(saved.advisor, 'Cody Raffary');
    assert.equal(saved.technician, 'BIG AL');

    const briefed = await json(`${base}/api/heat-cases/${created.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'brief' })
    });
    assert.equal(briefed.body.status, 'briefed');
    assert.ok(briefed.body.briefedAt);

    const resolved = await json(`${base}/api/heat-cases/${created.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'resolve', notes: 'Replaced pads, road test signed off.' })
    });
    assert.equal(resolved.body.status, 'resolved');
    assert.ok(resolved.body.resolvedAt);
    assert.match(resolved.body.resolutionNotes, /Replaced pads/);

    const summary = await json(`${base}/api/summary?date=${openedDate}`);
    assert.equal(summary.body.heatCases.openCount, 0);
    assert.equal(summary.body.heatCases.resolvedTodayCount, 1);
  });

  it('rejects a heat case without an issue', async () => {
    const result = await json(`${base}/api/heat-cases`, {
      method: 'POST',
      body: JSON.stringify({ customer: 'No Issue' })
    });
    assert.equal(result.status, 400);
  });

  it('serves the Sheet briefing layout with production board and hours table', async () => {
    const response = await fetch(`${base}/sheet-briefing?date=2026-08-29`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /BarrientCursor · Fixed operations/);
    assert.match(html, /Hours by technician/);
    assert.match(html, /id="hoursTable"/);
    assert.match(html, /Shop sold labor hours today/);
    assert.match(html, /onclick="setTab\('briefing'\)"/);
    assert.doesNotMatch(html, /<\?!= seedJson \?>/);
  });
});
