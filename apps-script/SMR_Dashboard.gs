/**
 * Writes a briefing snapshot to SMR_Dashboard only.
 */
function SMR_refreshDashboard() {
  var summary = SMR_getSummary(new Date());
  var sheet = SMR_sheet_(SMR_SHEETS.DASHBOARD);
  sheet.clear();
  sheet.getRange('A1').setValue('Service Manager Report');
  sheet.getRange('A2').setValue('Briefing date');
  sheet.getRange('B2').setValue(summary.date);
  sheet.getRange('A3').setValue('This sheet is owned by the SMR tool. Other workbook tabs are not changed.');

  var kpis = [
    ['Sold hours', summary.techHours.soldHours],
    ['Clock hours', summary.techHours.clockHours],
    ['Efficiency', summary.techHours.efficiency === null ? '—' : (summary.techHours.efficiency * 100).toFixed(1) + '%'],
    ['Daily gross', summary.gross.daily.totalGross],
    ['MTD gross', summary.gross.monthly.totalGross],
    ['Sold week Mon–Fri', summary.weekHours && summary.weekHours.sold ? summary.weekHours.sold.total : 0],
    ['Payroll week Tue–Mon', summary.weekHours && summary.weekHours.payroll ? summary.weekHours.payroll.total : 0],
    ['Open heat cases', summary.heatCases.openCount],
    ['Need briefing', summary.heatCases.awaitingBriefing],
    ['Resolved today', summary.heatCases.resolvedTodayCount]
  ];
  sheet.getRange(5, 1, kpis.length, 2).setValues(kpis);

  sheet.getRange('A18').setValue('Hours by technician');
  sheet.getRange('A19:D19').setValues([['Tech', 'Clock', 'Sold', 'Efficiency']]);
  if (summary.techHours.rows.length) {
    var hourRows = summary.techHours.rows.map(function (row) {
      var eff = row.clockHours ? row.soldHours / row.clockHours : null;
      return [row.techName, row.clockHours, row.soldHours, eff === null ? '—' : (eff * 100).toFixed(1) + '%'];
    });
    sheet.getRange(20, 1, hourRows.length, 4).setValues(hourRows);
  } else {
    sheet.getRange('A20').setValue('No hours reported for today.');
  }

  sheet.getRange('A32').setValue('Open heat cases');
  sheet.getRange('A33:H33').setValues([['Case ID', 'Customer', 'Advisor', 'Technician', 'RO', 'Severity', 'Status', 'Issue']]);
  if (summary.heatCases.open.length) {
    var heatRows = summary.heatCases.open.map(function (row) {
      return [row.id, row.customer, row.advisor || row.owner || '', row.technician || '', row.roNumber, row.severity, row.status, row.issue];
    });
    sheet.getRange(34, 1, heatRows.length, 8).setValues(heatRows);
  } else {
    sheet.getRange('A34').setValue('No open heat cases.');
  }

  sheet.getRange('A46').setValue('Resolved today');
  sheet.getRange('A47:C47').setValues([['Case ID', 'Resolved at', 'Resolution notes']]);
  if (summary.heatCases.resolvedToday.length) {
    var resolvedRows = summary.heatCases.resolvedToday.map(function (row) {
      return [row.id, row.resolvedAt, row.resolutionNotes];
    });
    sheet.getRange(48, 1, resolvedRows.length, 3).setValues(resolvedRows);
  } else {
    sheet.getRange('A48').setValue('No heat cases were marked resolved today.');
  }

  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, 8);
  return summary.date;
}
