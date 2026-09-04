/**
 * Writes a briefing snapshot to FLM_Dashboard only.
 */
function FLM_refreshDashboard() {
  return FLM_writeDashboard_(FLM_getSummary(new Date()));
}

function FLM_writeDashboard_(summary) {
  var sheet = FLM_sheet_(FLM_SHEETS.DASHBOARD);
  sheet.clear();
  sheet.getRange('A1').setValue('Fleet Manager Report');
  sheet.getRange('A2').setValue('Briefing date');
  sheet.getRange('B2').setValue(summary.date);
  sheet.getRange('A3').setValue('This sheet is owned by the FLM tool. DEALINPUT, FLEET CUSTOMERS, SUMMARY, HOME, SMR_*, and SLM_* tabs are not changed.');

  function money(value) {
    return FLM_roundMoney_(value);
  }
  function pct(value) {
    return value === null || value === undefined ? '—' : (value * 100).toFixed(1) + '%';
  }

  var kpis = [
    ['Working deals', summary.report.workingDeals],
    ['Sold deals', summary.report.soldDeals],
    ['Gross per unit', summary.metrics.gpu == null ? '—' : money(summary.metrics.gpu)],
    ['Monthly unit goal', summary.goal.unitGoal],
    ['Monthly gross goal', money(summary.goal.grossGoal)],
    ['Front gross today', money(summary.report.frontGross)],
    ['Finance gross today', money(summary.report.financeGross)],
    ['Total gross today', money(summary.report.totalGross)],
    ['MTD front gross', money(summary.monthly.frontGross)],
    ['MTD finance gross', money(summary.monthly.financeGross)],
    ['MTD total gross', money(summary.monthly.totalGross)],
    ['MTD sold deals', summary.monthly.soldDeals],
    ['Unit goal pace', pct(summary.monthly.metrics && summary.monthly.metrics.unitPace)],
    ['Daily deliveries', summary.report.deliveries],
    ['Daily courtesy deliveries', summary.report.courtesyDeliveries],
    ['Total expected deliveries', summary.expectedDeliveries.total],
    ['Expected from pipeline', summary.expectedDeliveries.fromPipeline],
    ['Expected today', summary.expectedDeliveries.today],
    ['MTD deliveries', summary.monthly.deliveries],
    ['MTD courtesy deliveries', summary.monthly.courtesyDeliveries]
  ];
  sheet.getRange(5, 1, kpis.length, 2).setValues(kpis);
  sheet.getRange('A27').setValue('Notes');
  sheet.getRange('B27').setValue(summary.report.notes || '');
  sheet.getRange('A29').setValue('Open working deals');
  sheet.getRange('A30:E30').setValues([['Account', 'Customer', 'Units', 'Expected', 'Status']]);
  if (summary.working.open && summary.working.open.length) {
    var rows = summary.working.open.map(function (row) {
      return [row.account, row.customer, row.units, row.expectedDelivery || '', row.status];
    });
    sheet.getRange(31, 1, rows.length, 5).setValues(rows);
  } else {
    sheet.getRange('A31').setValue('No open working deals.');
  }
  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, 5);
  return summary.date;
}
