/**
 * New inventory pricing.
 *
 * Do not add function onOpen, onEdit, doGet, or doPost. Code.gs already owns
 * the one onOpen for GEAUXCHEVROLETSALESLOG.
 *
 * In geauxMenuBlueprint_(), inside reports, add:
 *   { title: 'New Inventory Pricing', onOpen: 'NIP_onOpen' }
 *
 * That nests this menu under GEAUX REPORTS. Geaux Chevy opens in the sheet.
 * Web app link stays the Ford pricing page. This file does not write
 * DEALINPUT, DESKDATA, or LOGDEAL. Export builds a temporary spreadsheet,
 * downloads it, and moves that file to trash.
 */
function NIP_onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('New Inventory Pricing')
    .addItem('Geaux Chevy', 'GCY_open')
    .addItem('Web app link', 'NIP_showWebAppUrl')
    .addToUi();
}

function NIP_open() {
  var html = HtmlService.createHtmlOutputFromFile('NIP_App')
    .setWidth(1100)
    .setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(html, 'New inventory pricing');
}

function NIP_serveWebApp_() {
  return HtmlService.createHtmlOutputFromFile('NIP_App')
    .setTitle('Geaux Discount Position')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function NIP_exportReport(format, job) {
  var kind = String(format || '').toLowerCase();
  if (kind !== 'pdf' && kind !== 'xlsx') throw new Error('Choose PDF or Excel.');
  var table = NIP_exportTable_(job);
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

function NIP_showWebAppUrl() {
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (error) { url = ''; }
  if (!url) {
    SpreadsheetApp.getUi().alert('Deploy the web app first. In Apps Script choose Deploy, then New deployment, then Web app. Execute as Me. Who has access: Anyone.');
    return;
  }
  if (url.indexOf('page=pricing') < 0) url += (url.indexOf('?') < 0 ? '?' : '&') + 'page=pricing';
  SpreadsheetApp.getUi().alert('Web app', url, SpreadsheetApp.getUi().ButtonSet.OK);
}
