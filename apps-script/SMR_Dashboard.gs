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
    ['Sold hours', summary.production ? summary.production.soldHours : summary.techHours.soldHours],
    ['ELR', summary.production && summary.production.elr != null ? summary.production.elr : '—'],
    ['Hours / RO', summary.production && summary.production.hoursPerRo != null ? summary.production.hoursPerRo : '—'],
    ['Unapplied time', summary.production ? summary.production.unappliedHours : '—'],
    ['Open ROs', summary.repairOrders ? summary.repairOrders.openCount : 0],
    ['Opened today', summary.repairOrders
      ? (summary.repairOrders.openedCount != null ? summary.repairOrders.openedCount : summary.repairOrders.writtenCount)
      : 0],
    ['Closed today', summary.repairOrders ? summary.repairOrders.closedCount : 0],
    ['MTD opened', summary.repairOrders && summary.repairOrders.monthly ? summary.repairOrders.monthly.openedCount : 0],
    ['MTD closed', summary.repairOrders && summary.repairOrders.monthly ? summary.repairOrders.monthly.closedCount : 0],
    ['Daily gross', summary.gross.daily.totalGross],
    ['MTD gross', summary.gross.monthly.totalGross],
    ['Sold week Mon–Fri', summary.weekHours && summary.weekHours.sold ? summary.weekHours.sold.total : 0],
    ['Payroll week Tue–Mon', summary.weekHours && summary.weekHours.payroll ? summary.weekHours.payroll.total : 0],
    ['Open heat cases', summary.heatCases.openCount],
    ['Need briefing', summary.heatCases.awaitingBriefing],
    ['Resolved today', summary.heatCases.resolvedTodayCount],
    ['Open needs', summary.needs ? summary.needs.openCount : 0],
    ['Needs pending review', summary.needs ? summary.needs.pendingReviewCount : 0],
    ['Needs estimated cost', summary.needs ? summary.needs.estimatedCost : 0]
  ];
  sheet.getRange(5, 1, kpis.length, 2).setValues(kpis);

  sheet.getRange('A25').setValue('Hours by technician');
  sheet.getRange('A26:E26').setValues([['Tech', 'Clock', 'Sold', 'Unapplied', 'Efficiency']]);
  if (summary.techHours.rows.length) {
    var hourRows = summary.techHours.rows.map(function (row) {
      var eff = row.clockHours ? row.soldHours / row.clockHours : null;
      var unapplied = Math.round((SMR_toNumber_(row.clockHours) - SMR_toNumber_(row.soldHours)) * 10) / 10;
      return [row.techName, row.clockHours, row.soldHours, unapplied, eff === null ? '—' : (eff * 100).toFixed(1) + '%'];
    });
    sheet.getRange(27, 1, hourRows.length, 5).setValues(hourRows);
  } else {
    sheet.getRange('A27').setValue('No hours reported for today.');
  }

  sheet.getRange('A40').setValue('Open heat cases');
  sheet.getRange('A41:H41').setValues([['Case ID', 'Customer', 'Advisor', 'Technician', 'RO', 'Severity', 'Status', 'Issue']]);
  if (summary.heatCases.open.length) {
    var heatRows = summary.heatCases.open.map(function (row) {
      return [row.id, row.customer, row.advisor || row.owner || '', row.technician || '', row.roNumber, row.severity, row.status, row.issue];
    });
    sheet.getRange(42, 1, heatRows.length, 8).setValues(heatRows);
  } else {
    sheet.getRange('A42').setValue('No open heat cases.');
  }

  sheet.getRange('A68').setValue('Open needs');
  sheet.getRange('A69:F69').setValues([['Need ID', 'Item', 'Found date', 'Age (days)', 'Est. cost', 'Status']]);
  if (summary.needs && summary.needs.open && summary.needs.open.length) {
    var needRows = summary.needs.open.map(function (row) {
      return [row.id, row.item, row.foundDate, row.ageDays, row.estimatedCost, row.status];
    });
    sheet.getRange(70, 1, needRows.length, 6).setValues(needRows);
  } else {
    sheet.getRange('A70').setValue('No open needs.');
  }

  sheet.getRange('A54').setValue('Resolved today');
  sheet.getRange('A55:C55').setValues([['Case ID', 'Resolved at', 'Resolution notes']]);
  if (summary.heatCases.resolvedToday.length) {
    var resolvedRows = summary.heatCases.resolvedToday.map(function (row) {
      return [row.id, row.resolvedAt, row.resolutionNotes];
    });
    sheet.getRange(56, 1, resolvedRows.length, 3).setValues(resolvedRows);
  } else {
    sheet.getRange('A56').setValue('No heat cases were marked resolved today.');
  }

  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, 8);
  return summary.date;
}
