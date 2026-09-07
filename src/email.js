/**
 * Branded Geaux Chevrolet parts recap email. Pure HTML/text — no network I/O.
 */
import {
  formatLongDate,
  formatMoney,
  formatPercent,
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

function alertLine(item) {
  const color = item.level === 'crit' ? '#8a353b' : '#8a6818';
  return (
    `<div style="border-left:4px solid ${color};padding:8px 12px;margin:0 0 8px;background:${GEAUX_BRAND.paper};">` +
    `<div style="font-size:13px;font-weight:700;color:${GEAUX_BRAND.ink};">${escapeHtml(item.title)}</div>` +
    `<div style="font-size:12px;color:${GEAUX_BRAND.muted};margin-top:4px;">${escapeHtml(item.detail)}</div>` +
    `</div>`
  );
}

export function buildReportEmail({ snapshot, storeName = GEAUX_BRAND.storeName } = {}) {
  const today = snapshot || {};
  const report = today.report || {};
  const capital = today.capital || {};
  const sales = today.sales || {};
  const rim = today.rim || {};
  const flags = today.flags || { alerts: [], critCount: 0, warnCount: 0 };
  const dateLabel = formatLongDate(today.date || report.date);
  const subject = `${storeName} parts recap · ${dateLabel}`;
  const notes = String(report.notes || '').trim();
  const waitLabel = today.wait === 'crit' ? `${toNumber(report.counterWaitMinutes)} min · OVER` : `${toNumber(report.counterWaitMinutes)} min`;
  const rimLabel = rim.actual != null ? `${toNumber(rim.actual).toFixed(1)}%` : '—';
  const mtd = today.month || {};

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
              <div style="color:${GEAUX_BRAND.gold};font-size:14px;margin-top:10px;">Parts Manager Daily Recap</div>
              <div style="color:#f3ead0;font-size:18px;margin-top:14px;">${escapeHtml(dateLabel)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 8px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Inventory &amp; capital</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${tile('On-hand $', formatMoney(capital.inventoryValue))}
                  ${tile('Capital limit', formatMoney(capital.capitalLimit))}
                  ${tile('Variance', formatMoney(capital.variance))}
                  ${tile('N6M / 90+ day', formatMoney(capital.n6mValue))}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 8px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Service drive &amp; OEM</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${tile('Counter wait', waitLabel)}
                  ${tile('Lost sales $', formatMoney(report.lostSalesDollars))}
                  ${tile('SOP aged 14+', String(toNumber(today.sop?.agedCount)))}
                  ${tile('RIM %', rimLabel)}
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  ${tile('Parts sales', formatMoney(sales.totalSales))}
                  ${tile('Cores out', formatMoney(today.cores?.dollars))}
                  ${tile('Emergency / CSO', String(toNumber(report.emergencyOrderCount)))}
                  ${tile('Critical BO', String(toNumber(today.backorders?.criticalCount)))}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 8px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Month to date</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${tile('MTD sales', formatMoney(mtd.sales?.totalSales))}
                  ${tile('MTD lost $', formatMoney(mtd.lostSalesDollars))}
                  ${tile('MTD CSO', String(toNumber(mtd.emergencyOrderCount)))}
                  ${tile('MTD fuel', formatMoney(mtd.deliveryFuelCost))}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 8px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:8px;">GM flags · ${flags.critCount} critical · ${flags.warnCount} watch</div>
              ${flags.alerts && flags.alerts.length
                ? flags.alerts.map(alertLine).join('')
                : `<div style="padding:10px 12px;background:${GEAUX_BRAND.paper};border:1px solid #eadfbf;font-size:13px;">No flags for this day.</div>`}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 22px;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:8px;">Notes</div>
              <div style="background:${GEAUX_BRAND.paper};border:1px solid #eadfbf;padding:14px 16px;font-size:14px;line-height:1.5;color:${GEAUX_BRAND.ink};min-height:42px;">${notes ? escapeHtml(notes).replace(/\n/g, '<br />') : 'No notes for this day.'}</div>
              <p style="margin:10px 4px 0;font-size:12px;color:${GEAUX_BRAND.muted};">CDK pull: MGR→INV, RSM/RST, SOP→RO, LSL, IRE, ORD, CRA. Utilization ${formatPercent(capital.utilization)} · N3M ${formatMoney(capital.n3mValue)} · pad/overstock ${formatMoney(capital.overstockValue)}.</p>
            </td>
          </tr>
          <tr>
            <td style="background:${GEAUX_BRAND.navy};padding:16px 24px;text-align:center;">
              <div style="color:${GEAUX_BRAND.gold};font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Geaux Chevrolet</div>
              <div style="color:#d7deea;font-size:12px;margin-top:6px;">${GEAUX_BRAND.address}</div>
              <div style="color:#9aadc8;font-size:11px;margin-top:6px;">Internal parts recap · not a customer-facing mailer</div>
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
    `${storeName} parts recap`,
    dateLabel,
    '',
    `On-hand ${formatMoney(capital.inventoryValue)} vs limit ${formatMoney(capital.capitalLimit)} (${formatMoney(capital.variance)})`,
    `N3M ${formatMoney(capital.n3mValue)} · N6M ${formatMoney(capital.n6mValue)} · pad ${formatMoney(capital.overstockValue)}`,
    `Sales ${formatMoney(sales.totalSales)} · wait ${toNumber(report.counterWaitMinutes)} min · RIM ${rimLabel}`,
    `Lost sales ${formatMoney(report.lostSalesDollars)} · SOP aged ${toNumber(today.sop?.agedCount)} · cores ${formatMoney(today.cores?.dollars)}`,
    `Emergency/CSO ${toNumber(report.emergencyOrderCount)} · freight ${formatMoney(report.emergencyFreightCost)}`,
    '',
    `MTD sales ${formatMoney(mtd.sales?.totalSales)} · MTD lost ${formatMoney(mtd.lostSalesDollars)}`,
    '',
    flags.alerts && flags.alerts.length
      ? flags.alerts.map((item) => `[${item.level}] ${item.title}: ${item.detail}`).join('\n')
      : 'No flags for this day.',
    '',
    notes ? `Notes: ${notes}` : 'Notes: none',
    '',
    GEAUX_BRAND.address
  ].join('\n');

  return { subject, html, text, dateLabel };
}
