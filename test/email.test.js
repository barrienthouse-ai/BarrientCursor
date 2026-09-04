import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportEmail, isValidEmail, normalizeEmail } from '../src/email.js';
import { normalizeDailyReport } from '../src/reporting.js';

describe('report email', () => {
  it('accepts a later-provided address and rejects junk', () => {
    assert.equal(isValidEmail('sales@geauxchevrolet.com'), true);
    assert.equal(normalizeEmail('  gm@geauxchevrolet.com  '), 'gm@geauxchevrolet.com');
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(normalizeEmail(''), '');
  });

  it('builds a branded Geaux Chevrolet recap with today and MTD', () => {
    const report = normalizeDailyReport({
      date: '2026-08-31',
      newSold: 5,
      usedSold: 2,
      frontGross: -3600.05,
      backGross: 14298.98,
      appointments: 14,
      shownAppointments: 10,
      showroomVisits: 19,
      nextDayAppointments: 8,
      notes: 'Two used Tahoes in F&I overnight.'
    });
    const mail = buildReportEmail({
      report,
      monthlyPrior: {
        newSold: 16,
        usedSold: 0,
        totalGross: 5638.19,
        appointments: 63,
        shownAppointments: 43,
        showroomVisits: 86
      },
      nextBusinessDate: '2026-09-01'
    });
    assert.match(mail.subject, /Geaux Chevrolet sales recap/);
    assert.match(mail.subject, /August 31, 2026/);
    assert.match(mail.html, /GEAUX CHEVROLET/);
    assert.match(mail.html, /Sales Manager Daily Recap/);
    assert.match(mail.html, /Chevrolet dealer/);
    assert.match(mail.html, /5/);
    assert.match(mail.html, /\$10,698\.93/);
    assert.match(mail.html, /MTD new/);
    assert.match(mail.html, />21</);
    assert.match(mail.html, /68\.8%/);
    assert.match(mail.html, /Tahoes/);
    assert.match(mail.html, /LaPlace, LA 70068/);
    assert.match(mail.text, /Next business day: 2026-09-01/);
    assert.doesNotMatch(mail.html, /<script/i);
  });
});
