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
 * DEALINPUT, DESKDATA, LOGDEAL, or any other sheet.
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
