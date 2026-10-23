/**
 * Branded Geaux Chevrolet recap email. Sends through MailApp only.
 * Does not write DEALINPUT, SUMMARY, EMAIL_QUEUE, or any other live tab.
 */
function SLM_formatLongDate_(dateKey) {
  var parts = String(dateKey || '').split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  try {
    return Utilities.formatDate(date, Session.getScriptTimeZone() || 'America/Chicago', 'EEEE, MMMM d, yyyy');
  } catch (ignoreTz) {
    return String(dateKey || '');
  }
}

function SLM_escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function SLM_emailMoney_(value) {
  var amount = SLM_roundMoney_(value);
  var sign = amount < 0 ? '-' : '';
  return sign + '$' + Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function SLM_emailPct_(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  return (Number(value) * 100).toFixed(1) + '%';
}

function SLM_emailTile_(label, value) {
  return (
    '<td style="width:25%;padding:10px 8px;background:#ffffff;border:1px solid #eadfbf;text-align:center;vertical-align:top;">' +
    '<div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6a3a;">' + label + '</div>' +
    '<div style="font-size:20px;font-weight:700;color:#0E1624;margin-top:6px;line-height:1.2;">' + value + '</div>' +
    '</td>'
  );
}

function SLM_buildReportEmail_(input) {
  var report = (input && input.report) || {};
  var metrics = report.metrics || SLM_metrics_(report);
  var mtd = SLM_overlayMonthToDate_(input && input.monthlyPrior, report);
  var dateLabel = SLM_formatLongDate_(report.date);
  var nextDay = (input && input.nextBusinessDate) || report.nextBusinessDate || '';
  var notes = String(report.notes || '').trim();
  var subject = 'Geaux Chevrolet sales recap · ' + dateLabel;
  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head>' +
    '<body style="margin:0;padding:0;background:#FBF8F1;color:#1B1B1B;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F1;padding:24px 0;"><tr><td align="center">' +
    '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid #e4d7a8;">' +
    '<tr><td style="height:8px;background:#F0B429;font-size:0;line-height:0;">&nbsp;</td></tr>' +
    '<tr><td style="background:#111111;padding:28px 32px 24px;text-align:center;">' +
    '<div style="color:#F0B429;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;">Chevrolet dealer</div>' +
    '<div style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.12em;margin-top:8px;">GEAUX CHEVROLET</div>' +
    '<div style="color:#F0B429;font-size:14px;margin-top:10px;">Sales Manager Daily Recap</div>' +
    '<div style="color:#f3ead0;font-size:18px;margin-top:14px;">' + SLM_escapeHtml_(dateLabel) + '</div>' +
    '</td></tr>' +
    '<tr><td style="padding:22px 24px 8px;">' +
    '<div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Today</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    SLM_emailTile_('New sold', String(report.newSold || 0)) +
    SLM_emailTile_('Used sold', String(report.usedSold || 0)) +
    SLM_emailTile_('Total units', String(report.totalSold || 0)) +
    SLM_emailTile_('Total gross', SLM_emailMoney_(report.totalGross)) +
    '</tr></table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>' +
    SLM_emailTile_('Front gross', SLM_emailMoney_(report.frontGross)) +
    SLM_emailTile_('Back gross', SLM_emailMoney_(report.backGross)) +
    SLM_emailTile_('Show %', SLM_emailPct_(metrics.showRate)) +
    SLM_emailTile_('Close %', SLM_emailPct_(metrics.closeRate)) +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:8px 24px 8px;">' +
    '<div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Traffic</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    SLM_emailTile_('Appts', String(report.appointments || 0)) +
    SLM_emailTile_('Appts shown', String(report.shownAppointments || 0)) +
    SLM_emailTile_('Showroom visits', String(report.showroomVisits || 0)) +
    SLM_emailTile_('Next day appts', String(report.nextDayAppointments || 0)) +
    '</tr></table>' +
    '<p style="margin:10px 4px 0;font-size:13px;color:#5C6570;">Next business day is ' + SLM_escapeHtml_(nextDay) + ' · Sunday closed.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:8px 24px 8px;">' +
    '<div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:10px;">Month to date — includes today</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    SLM_emailTile_('MTD new', String(mtd.newSold || 0)) +
    SLM_emailTile_('MTD used', String(mtd.usedSold || 0)) +
    SLM_emailTile_('MTD gross', SLM_emailMoney_(mtd.totalGross)) +
    SLM_emailTile_('MTD appts', String(mtd.appointments || 0)) +
    '</tr></table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>' +
    SLM_emailTile_('MTD shown', String(mtd.shownAppointments || 0)) +
    SLM_emailTile_('MTD visits', String(mtd.showroomVisits || 0)) +
    SLM_emailTile_('MTD show %', SLM_emailPct_(mtd.metrics.showRate)) +
    SLM_emailTile_('MTD close %', SLM_emailPct_(mtd.metrics.closeRate)) +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:8px 24px 22px;">' +
    '<div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a6a3a;margin-bottom:8px;">Notes</div>' +
    '<div style="background:#FBF8F1;border:1px solid #eadfbf;padding:14px 16px;font-size:14px;line-height:1.5;color:#1B1B1B;">' +
    (notes ? SLM_escapeHtml_(notes).replace(/\n/g, '<br />') : 'No notes for this day.') +
    '</div></td></tr>' +
    '<tr><td style="background:#0E1624;padding:16px 24px;text-align:center;">' +
    '<div style="color:#F0B429;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Geaux Chevrolet</div>' +
    '<div style="color:#d7deea;font-size:12px;margin-top:6px;">2020 W. Airline Hwy, LaPlace, LA 70068</div>' +
    '<div style="color:#9aadc8;font-size:11px;margin-top:6px;">Internal sales recap · not a customer-facing mailer</div>' +
    '</td></tr>' +
    '<tr><td style="height:8px;background:#F0B429;font-size:0;line-height:0;">&nbsp;</td></tr>' +
    '</table></td></tr></table></body></html>';
  var text = [
    'Geaux Chevrolet sales recap',
    dateLabel,
    '',
    'Today: ' + report.newSold + ' new / ' + report.usedSold + ' used / ' + report.totalSold + ' total · ' + SLM_emailMoney_(report.totalGross),
    'Show ' + SLM_emailPct_(metrics.showRate) + ' · Close ' + SLM_emailPct_(metrics.closeRate),
    'Traffic: ' + report.appointments + ' appts, ' + report.shownAppointments + ' shown, ' + report.showroomVisits + ' visits',
    'Next business day: ' + nextDay,
    '',
    'MTD: ' + mtd.newSold + ' new / ' + mtd.usedSold + ' used · ' + SLM_emailMoney_(mtd.totalGross),
    'MTD show ' + SLM_emailPct_(mtd.metrics.showRate) + ' · MTD close ' + SLM_emailPct_(mtd.metrics.closeRate),
    '',
    notes ? 'Notes: ' + notes : 'Notes: none'
  ].join('\n');
  return { subject: subject, html: html, text: text };
}

function SLM_promptReportEmail() {
  var ui = SpreadsheetApp.getUi();
  var current = SLM_getReportEmail_() || '';
  var asked = ui.prompt(
    'Report email',
    'Where should the daily recap be sent? Leave this blank for now if you will add it later on the SLM_Config tab (Report email).' +
      (current ? '\n\nCurrent: ' + current : ''),
    ui.ButtonSet.OK_CANCEL
  );
  if (asked.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  var saved = SLM_setReportEmail_(asked.getResponseText());
  ui.alert(saved ? 'Report email saved: ' + saved : 'Report email cleared. Add it later on SLM_Config.');
}
