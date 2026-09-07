import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportEmail, isValidEmail, normalizeEmail } from '../src/email.js';
import { buildDailySnapshot, normalizeDailyReport } from '../src/reporting.js';

describe('report email', () => {
  it('accepts a later-provided address and rejects junk', () => {
    assert.equal(isValidEmail('gm@geauxchevrolet.com'), true);
    assert.equal(normalizeEmail('  parts@geauxchevrolet.com  '), 'parts@geauxchevrolet.com');
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(normalizeEmail(''), '');
  });

  it('builds a branded Geaux Chevrolet parts recap with GM flags', () => {
    const snapshot = buildDailySnapshot({
      dateKey: '2026-09-05',
      reports: [normalizeDailyReport({
        date: '2026-09-05',
        inventoryValue: 521340,
        capitalLimit: 500000,
        n6mValue: 48150,
        counterWaitMinutes: 8,
        retailSales: 10240,
        wholesaleSales: 4680,
        internalSales: 8120,
        rimCompliancePercent: 87,
        outstandingCoresValue: 2490,
        notes: 'Need GM return on N6M before month-end.'
      })],
      sopItems: [{ receivedDate: '2026-08-20', status: 'rec', dollars: 890, partNumber: '84710922' }]
    });
    const mail = buildReportEmail({ snapshot });
    assert.match(mail.subject, /Geaux Chevrolet parts recap/);
    assert.match(mail.subject, /September 5, 2026/);
    assert.match(mail.html, /GEAUX CHEVROLET/);
    assert.match(mail.html, /Parts Manager Daily Recap/);
    assert.match(mail.html, /Inventory over capital limit/);
    assert.match(mail.html, /N6M/);
    assert.match(mail.html, /LaPlace, LA 70068/);
    assert.match(mail.text, /Need GM return/);
    assert.doesNotMatch(mail.html, /<script/i);
  });
});
