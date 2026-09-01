/**
 * Writes a recap snapshot to SLM_Dashboard only.
 */
function SLM_refreshDashboard() {
  var summary = SLM_getSummary(new Date());
  var sheet = SLM_sheet_(SLM_SHEETS.DASHBOARD);
  sheet.clear();
  sheet.getRange('A1').setValue('Sales Manager Report');
  sheet.getRange('A2').setValue('Recap date');
  sheet.getRange('B2').setValue(summary.date);
  sheet.getRange('A3').setValue('This sheet is owned by the SLM tool. DEALINPUT, SUMMARY, HOME, and other workbook tabs are not changed.');

  function money(value) {
    return SLM_roundMoney_(value);
  }
  function pct(value) {
    return value === null || value === undefined ? '—' : (value * 100).toFixed(1) + '%';
  }

  var kpis = [
    ['New sold', summary.report.newSold],
    ['Used sold', summary.report.usedSold],
    ['Total units', summary.report.totalSold],
    ['Front gross', money(summary.report.frontGross)],
    ['Back gross', money(summary.report.backGross)],
    ['Total gross', money(summary.report.totalGross)],
    ['Appointments', summary.report.appointments],
    ['Shown appointments', summary.report.shownAppointments],
    ['Showroom visits', summary.report.showroomVisits],
    ['Show rate', pct(summary.metrics.showRate)],
    ['Close rate', pct(summary.metrics.closeRate)],
    ['Next business day', summary.nextBusinessDate],
    ['Appts next business day', summary.report.nextDayAppointments],
    ['MTD new', summary.monthly.newSold],
    ['MTD used', summary.monthly.usedSold],
    ['MTD total gross', money(summary.monthly.totalGross)]
  ];
  sheet.getRange(5, 1, kpis.length, 2).setValues(kpis);
  sheet.getRange('A23').setValue('Notes');
  sheet.getRange('B23').setValue(summary.report.notes || '');
  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, 2);
  return summary.date;
}
