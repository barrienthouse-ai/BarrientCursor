/**
 * Spreadsheet menu + one-time setup.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GEAUX Desk')
    .addItem('Open Desking Tool', 'OPEN_DESKING_TOOL')
    .addSeparator()
    .addItem('Create/refresh config sheets', 'ensureConfigSheets')
    .addItem('Publish quote brochures', 'publishQuoteBrochures')
    .addItem('Save Web App URL', 'setWebAppUrl')
    .addItem('Send test quote email', 'testEmailNotification')
    .addToUi();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
