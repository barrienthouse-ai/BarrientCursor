/**
 * Branded Geaux Chevrolet parts recap. Sends through MailApp only.
 * Does not write PARTS_TICKETS, EMAIL_QUEUE, SUMMARY, or any other live tab.
 */
function PMR_emailMoney_(value) {
  var amount = PMR_roundMoney_(value);
  var sign = amount < 0 ? '-' : '';
  return sign + '$' + Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function PMR_escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function PMR_emailTile_(label, value) {
  return (
    '<td style="width:25%;padding:10px 8px;background:#ffffff;border:1px solid #eadfbf;text-align:center;vertical-align:top;">' +
    '<div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6a3a;">' + label + '</div>' +
    '<div style="font-size:20px;font-weight:700;color:#0E1624;margin-top:6px;line-height:1.2;">' + value + '</div>' +
    '</td>'
  );
}

function PMR_getReportEmail_() {
  return String(PMR_getConfig().reportEmail || '').trim();
}

function PMR_setReportEmail_(value) {
  var text = String(value || '').trim();
  PMR_setConfigValue_('Report email', text);
  return text;
}

function PMR_promptReportEmail() {
  var ui = SpreadsheetApp.getUi();
  var current = PMR_getReportEmail_() || '';
  var asked = ui.prompt(
    'Report email',
    'Where should the daily parts recap be sent? Leave blank to add it later on PMR_Config (Report email).' +
      (current ? '\n\nCurrent: ' + current : ''),
    ui.ButtonSet.OK_CANCEL
  );
  if (asked.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  var saved = PMR_setReportEmail_(asked.getResponseText());
  ui.alert(saved ? 'Report email saved: ' + saved : 'Report email cleared. Add it later on PMR_Config.');
}

function PMR_buildReportEmail_(summary) {
  summary = summary || {};
  var report = summary.report || {};
  var capital = summary.capital || {};
  var sales = summary.sales || {};
  var rim = summary.rim || {};
  var flags = summary.flags || { alerts: [] };
  var dateLabel = summary.date || '';
  try {
    var parts = String(summary.date || '').split('-');
    dateLabel = Utilities.formatDate(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])), Session.getScriptTimeZone() || 'America/Chicago', 'EEEE, MMMM d, yyyy');
  } catch (ignoreTz) {}
  var subject = 'Geaux Chevrolet parts recap · ' + dateLabel;
  var notes = String(report.notes || '').trim();
  var alertHtml = '';
  (flags.alerts || []).forEach(function (item) {
    var color = item.level === 'crit' ? '#8a353b' : '#8a6818';
    alertHtml += '<div style="border-left:4px solid ' + color + ';padding:8px 12px;margin:0 0 8px;background:#FBF8F1;">' +
      '<div style="font-size:13px;font-weight:700;">' + PMR_escapeHtml_(item.title) + '</div>' +
      '<div style="font-size:12px;color:#5C6570;margin-top:4px;">' + PMR_escapeHtml_(item.detail) + '</div></div>';
  });
  if (!alertHtml) {
    alertHtml = '<div style="padding:10px 12px;background:#FBF8F1;border:1px solid #eadfbf;font-size:13px;">No flags for this day.</div>';
  }
  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head>' +
    '<body style="margin:0;padding:0;background:#FBF8F1;color:#1B1B1B;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F1;padding:24px 0;"><tr><td align="center">' +
    '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid #e4d7a8;">' +
    '<tr><td style="height:8px;background:#F0B429;font-size:0;line-height:0;">&nbsp;</td></tr>' +
    '<tr><td style="background:#111111;padding:28px 32px 24px;text-align:center;">' +
    '<div style="color:#F0B429;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;">Chevrolet dealer</div>' +
    '<div style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.12em;margin-top:8px;">GEAUX CHEVROLET</div>' +
    '<div style="color:#F0B429;font-size:14px;margin-top:10px;">Parts Manager Daily Recap</div>' +
    '<div style="color:#f3ead0;font-size:18px;margin-top:14px;">' + PMR_escapeHtml_(dateLabel) + '</div>' +
    '</td></tr>' +
    '<tr><td style="padding:22px 24px 8px;">' +
    '<div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Inventory &amp; capital</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    PMR_emailTile_('On-hand $', PMR_emailMoney_(capital.inventoryValue)) +
    PMR_emailTile_('Capital limit', PMR_emailMoney_(capital.capitalLimit)) +
    PMR_emailTile_('Variance', PMR_emailMoney_(capital.variance)) +
    PMR_emailTile_('N6M / 90+ day', PMR_emailMoney_(capital.n6mValue)) +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:8px 24px 8px;">' +
    '<div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Service drive &amp; OEM</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    PMR_emailTile_('Counter wait', PMR_toNumber_(report.counterWaitMinutes) + ' min') +
    PMR_emailTile_('Lost sales $', PMR_emailMoney_(report.lostSalesDollars)) +
    PMR_emailTile_('SOP aged 14+', String((summary.sop && summary.sop.agedCount) || 0)) +
    PMR_emailTile_('RIM %', String(rim.actual || 0) + '%') +
    '</tr></table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>' +
    PMR_emailTile_('Parts sales', PMR_emailMoney_(sales.totalSales)) +
    PMR_emailTile_('Cores out', PMR_emailMoney_(summary.cores && summary.cores.dollars)) +
    PMR_emailTile_('Emergency / CSO', String(report.emergencyOrderCount || 0)) +
    PMR_emailTile_('Critical BO', String((summary.backorders && summary.backorders.criticalCount) || 0)) +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:8px 24px 8px;"><div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:8px;">GM flags</div>' +
    alertHtml + '</td></tr>' +
    '<tr><td style="padding:8px 24px 22px;"><div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:8px;">Notes</div>' +
    '<div style="background:#FBF8F1;border:1px solid #eadfbf;padding:14px 16px;font-size:14px;line-height:1.5;">' +
    (notes ? PMR_escapeHtml_(notes).replace(/\n/g, '<br />') : 'No notes for this day.') +
    '</div></td></tr>' +
    '<tr><td style="background:#0E1624;padding:16px 24px;text-align:center;">' +
    '<div style="color:#F0B429;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Geaux Chevrolet</div>' +
    '<div style="color:#d7deea;font-size:12px;margin-top:6px;">2020 W. Airline Hwy, LaPlace, LA 70068</div>' +
    '<div style="color:#9aadc8;font-size:11px;margin-top:6px;">Internal parts recap · not a customer-facing mailer</div>' +
    '</td></tr>' +
    '<tr><td style="height:8px;background:#F0B429;font-size:0;line-height:0;">&nbsp;</td></tr>' +
    '</table></td></tr></table></body></html>';
  var text = [
    'Geaux Chevrolet parts recap',
    dateLabel,
    'On-hand ' + PMR_emailMoney_(capital.inventoryValue) + ' vs ' + PMR_emailMoney_(capital.capitalLimit),
    'RIM ' + rim.actual + '% · wait ' + report.counterWaitMinutes + ' min · cores ' + PMR_emailMoney_(summary.cores && summary.cores.dollars),
    notes ? 'Notes: ' + notes : 'Notes: none'
  ].join('\n');
  return { subject: subject, html: html, text: text };
}

function PMR_emailToday() {
  var summary = PMR_getSummary(new Date());
  var mail = PMR_buildReportEmail_(summary);
  var to = PMR_getReportEmail_();
  if (!to) {
    SpreadsheetApp.getUi().alert('Set a report email first (Parts Manager Report → Set report email). Preview subject:\n' + mail.subject);
    return;
  }
  MailApp.sendEmail({ to: to, subject: mail.subject, htmlBody: mail.html, body: mail.text });
  SpreadsheetApp.getUi().alert('Sent parts recap to ' + to);
}

function PMR_emailReport(payload) {
  var summary = PMR_saveDailyReport(payload || {});
  var mail = PMR_buildReportEmail_(summary);
  var to = String((payload && payload.to) || PMR_getReportEmail_() || '').trim();
  if (to) {
    PMR_setReportEmail_(to);
    MailApp.sendEmail({ to: to, subject: mail.subject, htmlBody: mail.html, body: mail.text });
    return { sent: true, saved: true, to: to, subject: mail.subject, snapshot: summary };
  }
  return { sent: false, preview: true, saved: true, needsEmail: true, subject: mail.subject, html: mail.html, snapshot: summary, message: 'Saved. Add a report email on PMR_Config to send.' };
}
