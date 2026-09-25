/**
 * Geaux Chevy new-inventory pricing. Opens in the sheet.
 *
 * Do not add function onOpen, onEdit, doGet, or doPost. Code.gs owns onOpen.
 * NIP_Menu.gs owns the web app link. This file does not write DEALINPUT,
 * DESKDATA, LOGDEAL, or any other sheet.
 */
function GCY_open() {
  var html = HtmlService.createHtmlOutputFromFile('GCY_App')
    .setWidth(1100)
    .setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(html, 'Geaux Chevy discount position');
}
