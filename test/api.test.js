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
    dir = mkdtempSync(path.join(tmpdir(), 'slm-'));
    const filePath = path.join(dir, 'store.json');
    const seeded = emptyStore();
    seeded.dealLog = [
      { date: '2026-08-31', type: 'RETAIL', dept: 'New', frontGross: -720.01, backGross: 2042.71 },
      { date: '2026-08-31', type: 'RETAIL', dept: 'Used', frontGross: 0, backGross: 2042.71 },
      { date: '2026-08-31', type: 'Wholesale', dept: 'Used', frontGross: 5000, backGross: 0 }
    ];
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
    assert.equal(result.body.service, 'sales-manager-report');
  });

  it('saves and recalls an end-of-day recap', async () => {
    const saved = await json(`${base}/api/daily-report`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-08-31',
        newSold: 5,
        usedSold: 2,
        frontGross: -3600.06,
        backGross: 14298.98,
        appointments: 14,
        shownAppointments: 10,
        showroomVisits: 19,
        nextDayAppointments: 8,
        notes: 'Strong Saturday. Two used Tahoes in F&I late.'
      })
    });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.saved, true);
    assert.equal(saved.body.report.totalSold, 7);
    assert.equal(saved.body.report.totalGross, 10698.92);
    assert.equal(saved.body.report.nextBusinessDate, '2026-09-01');
    assert.equal(saved.body.metrics.showRate, 10 / 14);
    assert.equal(saved.body.metrics.closeRate, 7 / 19);

    const recalled = await json(`${base}/api/daily-report/2026-08-31`);
    assert.equal(recalled.body.report.newSold, 5);
    assert.equal(recalled.body.report.usedSold, 2);
    assert.equal(recalled.body.report.appointments, 14);
    assert.equal(recalled.body.report.shownAppointments, 10);
    assert.equal(recalled.body.report.showroomVisits, 19);
    assert.equal(recalled.body.report.nextDayAppointments, 8);
    assert.match(recalled.body.report.notes, /Tahoes/);
  });

  it('replaces the same date instead of duplicating it', async () => {
    await json(`${base}/api/daily-report`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-08-31',
        newSold: 6,
        usedSold: 1,
        frontGross: 100,
        backGross: 200,
        appointments: 12,
        shownAppointments: 9,
        showroomVisits: 15,
        nextDayAppointments: 6
      })
    });
    const history = await json(`${base}/api/history?from=2026-08-31&to=2026-08-31`);
    assert.equal(history.body.rows.length, 1);
    assert.equal(history.body.rows[0].newSold, 6);
    assert.equal(history.body.rows[0].usedSold, 1);
    assert.equal(history.body.rows[0].totalGross, 300);
  });

  it('fills units and gross from the retail deal log without touching traffic until saved', async () => {
    const filled = await json(`${base}/api/fill-from-deal-log`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-08-31',
        appointments: 14,
        shownAppointments: 10,
        showroomVisits: 19,
        nextDayAppointments: 8
      })
    });
    assert.equal(filled.status, 200);
    assert.equal(filled.body.report.source, 'deal-log');
    assert.equal(filled.body.dealLog.daily.newSold, 1);
    assert.equal(filled.body.dealLog.daily.usedSold, 1);
    assert.equal(filled.body.report.newSold, 1);
    assert.equal(filled.body.report.usedSold, 1);
    assert.equal(filled.body.report.totalGross, 3365.41);
    assert.equal(filled.body.report.appointments, 14);
  });

  it('keeps DEALINPUT and service manager sheets read-only', async () => {
    const audit = await json(`${base}/api/compatibility`);
    assert.equal(audit.body.safeToInstall, true);
    assert.ok(audit.body.protectedHits.includes('DEALINPUT'));
    assert.ok(audit.body.protectedHits.includes('SMR_Dashboard'));
  });
});
