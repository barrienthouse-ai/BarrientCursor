/**
 * Writes a briefing snapshot to PMR_Dashboard only.
 */
function PMR_refreshDashboard() {
  var summary = PMR_getSummary(new Date());
  var sheet = PMR_sheet_(PMR_SHEETS.DASHBOARD);
  sheet.clear();
  sheet.getRange('A1').setValue('Parts Manager Report');
  sheet.getRange('A2').setValue('Briefing date');
  sheet.getRange('B2').setValue(summary.date);
  sheet.getRange('A3').setValue('This sheet is owned by the PMR tool. Other workbook tabs are not changed. CDK codes: MGR→INV, RSM/RST, SOP→RO, LSL, IRE, ORD, CRA.');

  var kpis = [
    ['Inventory on hand', summary.capital.inventoryValue],
    ['Capital limit', summary.capital.capitalLimit],
    ['Variance', summary.capital.variance],
    ['N3M', summary.capital.n3mValue],
    ['N6M / 90+ day', summary.capital.n6mValue],
    ['Pad / overstock', summary.capital.overstockValue],
    ['Parts sales today', summary.sales.totalSales],
    ['Counter wait minutes', summary.report.counterWaitMinutes],
    ['Lost sales $', summary.report.lostSalesDollars],
    ['SOP aged 14+', summary.sop.agedCount],
    ['RIM %', summary.rim.actual],
    ['RIM target %', summary.rim.target],
    ['Emergency / CSO', summary.report.emergencyOrderCount],
    ['Outstanding cores $', summary.cores.dollars],
    ['Critical backorders', summary.backorders.criticalCount],
    ['Wholesale stops', summary.report.wholesaleStops],
    ['Hot-shots', summary.report.hotshotRuns],
    ['GM flags critical', summary.flags.critCount],
    ['GM flags watch', summary.flags.warnCount]
  ];
  sheet.getRange(5, 1, kpis.length, 2).setValues(kpis);

  sheet.getRange('A26').setValue('GM flags');
  sheet.getRange('A27:C27').setValues([['Level', 'Title', 'Detail']]);
  if (summary.flags.alerts.length) {
    var flagRows = summary.flags.alerts.map(function (row) {
      return [row.level, row.title, row.detail];
    });
    sheet.getRange(28, 1, flagRows.length, 3).setValues(flagRows);
  } else {
    sheet.getRange('A28').setValue('No flags for this day.');
  }

  sheet.getRange('A42').setValue('SOP in REC');
  sheet.getRange('A43:F43').setValues([['Part', 'Customer', 'RO', 'Age days', 'Dollars', 'Status']]);
  if (summary.sop.rec.length) {
    var sopRows = summary.sop.rec.map(function (row) {
      return [row.partNumber, row.customer, row.roNumber, row.ageDays, row.dollars, row.status];
    });
    sheet.getRange(44, 1, sopRows.length, 6).setValues(sopRows);
  } else {
    sheet.getRange('A44').setValue('No special orders sitting in REC.');
  }

  sheet.getRange('A56').setValue('Critical backorders');
  sheet.getRange('A57:E57').setValues([['Part', 'Vehicle', 'Reason', 'ETA', 'Severity']]);
  if (summary.backorders.critical.length) {
    var boRows = summary.backorders.critical.map(function (row) {
      return [row.partNumber, row.vehicle, row.reason, row.eta, row.severity];
    });
    sheet.getRange(58, 1, boRows.length, 5).setValues(boRows);
  } else {
    sheet.getRange('A58').setValue('No critical backorders.');
  }

  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, 6);
  return summary.date;
}
