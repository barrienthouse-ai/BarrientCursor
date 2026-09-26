/**
 * Geaux Chevy new-inventory pricing. Opens in the sheet.
 *
 * Do not add function onOpen, onEdit, doGet, or doPost. Code.gs owns onOpen.
 * NIP_Menu.gs owns the web app link. This file does not write DEALINPUT,
 * DESKDATA, or LOGDEAL. Export builds a temporary spreadsheet, downloads it,
 * and moves that file to trash.
 */
function GCY_open() {
  var html = HtmlService.createHtmlOutputFromFile('GCY_App')
    .setWidth(1100)
    .setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(html, 'Geaux Chevy discount position');
}

function GCY_exportReport(format, job) {
  var kind = String(format || '').toLowerCase();
  if (kind !== 'pdf' && kind !== 'xlsx') throw new Error('Choose PDF or Excel.');
  var table = GCY_exportTable_(job);
  if (!table.rows.length) throw new Error('Run the report before exporting.');
  var ss = SpreadsheetApp.create(table.title);
  var id = ss.getId();
  try {
    var summary = ss.getSheets()[0];
    summary.setName('Comparison');
    var values = [table.headers].concat(table.rows);
    summary.getRange(1, 1, values.length, table.headers.length).setValues(values);
    summary.setFrozenRows(1);
    summary.getRange(1, 1, 1, table.headers.length).setFontWeight('bold').setBackground('#1c2430').setFontColor('#ffffff');
    var widths = [64, 110, 150, 160, 72, 90, 72];
    for (var i = 7; i < table.headers.length - 2; i++) widths.push(110);
    widths.push(72, 90);
    for (var w = 0; w < widths.length && w < table.headers.length; w++) summary.setColumnWidth(w + 1, widths[w]);
    if (table.details.length) {
      var detail = ss.insertSheet('Vehicles');
      var detailValues = [table.detailHeaders].concat(table.details);
      detail.getRange(1, 1, detailValues.length, table.detailHeaders.length).setValues(detailValues);
      detail.setFrozenRows(1);
      detail.getRange(1, 1, 1, table.detailHeaders.length).setFontWeight('bold').setBackground('#1c2430').setFontColor('#ffffff');
    }
    SpreadsheetApp.flush();
    var url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=' + (kind === 'pdf' ? 'pdf' : 'xlsx');
    if (kind === 'pdf') {
      url += '&portrait=false&fitw=true&gridlines=false&fzr=true&size=1&sheetnames=false&printtitle=false&pagenumbers=false&gid=' + summary.getSheetId();
      url += '&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4';
    }
    var response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    var blob = response.getBlob();
    if (response.getResponseCode() !== 200 || /text\/html/i.test(String(blob.getContentType() || ''))) {
      throw new Error('Could not build the file. Approve the spreadsheet permission and run the export again.');
    }
    return {
      name: table.fileName + (kind === 'pdf' ? '.pdf' : '.xlsx'),
      mime: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } finally {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (ignore) {}
  }
}
