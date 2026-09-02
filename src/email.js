/**
 * Branded Geaux Chevrolet recap email. Pure HTML/text — no network I/O.
 */
import {
  formatLongDate,
  formatMoney,
  formatPercent,
  overlayMonthToDate,
  reportMetrics,
  toNumber
} from './reporting.js';

export const GEAUX_BRAND = {
  storeName: 'Geaux Chevrolet',
  cityLine: 'LaPlace, Louisiana',
  address: '2020 W. Airline Hwy, LaPlace, LA 70068',
  gold: '#F0B429',
  black: '#111111',
  navy: '#0E1624',
  paper: '#FBF8F1',
  ink: '#1B1B1B',
  muted: '#5C6570'
};

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function normalizeEmail(value) {
  const text = String(value || '').trim();
  return isValidEmail(text) ? text : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tile(label, value) {
  return (
    `<td style="width:25%;padding:10px 8px;background:#ffffff;border:1px solid #eadfbf;text-align:center;vertical-align:top;">` +
    `<div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6a3a;">${label}</div>` +
    `<div style="font-size:20px;font-weight:700;color:${GEAUX_BRAND.navy};margin-top:6px;line-height:1.2;">${value}</div>` +
    `</td>`
  );
}

export function buildReportEmail({ report, monthlyPrior = {}, nextBusinessDate, storeName = GEAUX_BRAND.storeName }) {
  const today = report || {};
  const metrics = today.metrics || reportMetrics(today);
  const mtd = overlayMonthToDate(monthlyPrior, today);
  const dateLabel = formatLongDate(today.date);
  const subject = `${storeName} sales recap · ${dateLabel}`;
  const notes = String(today.notes || '').trim();
  const nextDay = nextBusinessDate || today.nextBusinessDate || '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${GEAUX_BRAND.paper};color:${GEAUX_BRAND.ink};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GEAUX_BRAND.paper};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid #e4d7a8;">
          <tr><td style="height:8px;background:${GEAUX_BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:${GEAUX_BRAND.black};padding:28px 32px 24px;text-align:center;">
              <div style="color:${GEAUX_BRAND.gold};font-size:11px;letter-spacing:0.42em;text-transform:uppercase;">Chevrolet dealer</div>
              <div style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.12em;margin-top:8px;">GEAUX CHEVROLET</div>
              <div style="color:${GEAUX_BRAND.gold};font-size:14px;margin-top:10px;">Sales Manager Daily Recap</div>
              <div style="color:#f3ead0;font-size:18px;margin-top:14px;">${escapeHtml(dateLabel)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 8px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Today</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${tile('New sold', String(toNumber(today.newSold)))}
                  ${tile('Used sold', String(toNumber(today.usedSold)))}
                  ${tile('Total units', String(toNumber(today.totalSold)))}
                  ${tile('Total gross', formatMoney(today.totalGross))}
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  ${tile('Front gross', formatMoney(today.frontGross))}
                  ${tile('Back gross', formatMoney(today.backGross))}
                  ${tile('Show %', formatPercent(metrics.showRate))}
                  ${tile('Close %', formatPercent(metrics.closeRate))}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 8px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Traffic</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${tile('Appts', String(toNumber(today.appointments)))}
                  ${tile('Appts shown', String(toNumber(today.shownAppointments)))}
                  ${tile('Showroom visits', String(toNumber(today.showroomVisits)))}
                  ${tile('Next day appts', String(toNumber(today.nextDayAppointments)))}
                </tr>
              </table>
              <p style="margin:10px 4px 0;font-size:13px;color:${GEAUX_BRAND.muted};">Next business day is ${escapeHtml(nextDay)} · Sunday closed.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 8px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Month to date — includes today</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${tile('MTD new', String(toNumber(mtd.newSold)))}
                  ${tile('MTD used', String(toNumber(mtd.usedSold)))}
                  ${tile('MTD gross', formatMoney(mtd.totalGross))}
                  ${tile('MTD appts', String(toNumber(mtd.appointments)))}
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  ${tile('MTD shown', String(toNumber(mtd.shownAppointments)))}
                  ${tile('MTD visits', String(toNumber(mtd.showroomVisits)))}
                  ${tile('MTD show %', formatPercent(mtd.metrics.showRate))}
                  ${tile('MTD close %', formatPercent(mtd.metrics.closeRate))}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 22px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:8px;">Notes</div>
              <div style="background:${GEAUX_BRAND.paper};border:1px solid #eadfbf;padding:14px 16px;font-size:14px;line-height:1.5;color:${GEAUX_BRAND.ink};min-height:42px;">${notes ? escapeHtml(notes).replace(/\n/g, '<br />') : 'No notes for this day.'}</div>
            </td>
          </tr>
          <tr>
            <td style="background:${GEAUX_BRAND.navy};padding:16px 24px;text-align:center;">
              <div style="color:${GEAUX_BRAND.gold};font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Geaux Chevrolet</div>
              <div style="color:#d7deea;font-size:12px;margin-top:6px;">${GEAUX_BRAND.address}</div>
              <div style="color:#9aadc8;font-size:11px;margin-top:6px;">Internal sales recap · not a customer-facing mailer</div>
            </td>
          </tr>
          <tr><td style="height:8px;background:${GEAUX_BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${storeName} sales recap`,
    dateLabel,
    '',
    `Today: ${today.newSold} new / ${today.usedSold} used / ${today.totalSold} total · ${formatMoney(today.totalGross)}`,
    `Front ${formatMoney(today.frontGross)} · Back ${formatMoney(today.backGross)}`,
    `Show ${formatPercent(metrics.showRate)} · Close ${formatPercent(metrics.closeRate)}`,
    `Traffic: ${today.appointments} appts, ${today.shownAppointments} shown, ${today.showroomVisits} visits, ${today.nextDayAppointments} next-day`,
    `Next business day: ${nextDay}`,
    '',
    `MTD: ${mtd.newSold} new / ${mtd.usedSold} used · ${formatMoney(mtd.totalGross)}`,
    `MTD traffic: ${mtd.appointments} appts, ${mtd.shownAppointments} shown, ${mtd.showroomVisits} visits`,
    `MTD show ${formatPercent(mtd.metrics.showRate)} · MTD close ${formatPercent(mtd.metrics.closeRate)}`,
    '',
    notes ? `Notes: ${notes}` : 'Notes: none',
    '',
    GEAUX_BRAND.address
  ].join('\n');

  return { subject, html, text, dateLabel, mtd };
}
