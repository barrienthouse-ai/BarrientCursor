/**
 * New inventory pricing.
 *
 * Do not add function onOpen, onEdit, doGet, or doPost. Code.gs already owns
 * the one onOpen for GEAUXCHEVROLETSALESLOG.
 *
 * In geauxMenuBlueprint_(), inside reports, add:
 *   { title: 'New Inventory Pricing', onOpen: 'NIP_onOpen' }
 *
 * That nests this menu under GEAUX REPORTS. This file does not write
 * DEALINPUT, DESKDATA, LOGDEAL, or any other sheet.
 */
function NIP_onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('New Inventory Pricing')
    .addItem('Compare discounts', 'NIP_open')
    .addToUi();
}

function NIP_open() {
  var html = HtmlService.createHtmlOutputFromFile('NIP_App')
    .setWidth(1100)
    .setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(html, 'New inventory pricing');
}
