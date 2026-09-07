/**
 * Read-only helpers against the live Geaux Chevrolet workbook.
 * These functions never write PARTS_*, SVC_*, SLM_*, SMR_*, or FLM_* tabs.
 */
function PMR_peekExistingPartsData() {
  var ss = PMR_ss_();
  var tickets = ss.getSheetByName('PARTS_TICKETS');
  var items = ss.getSheetByName('PARTS_ITEMS');
  var requests = ss.getSheetByName('SVC_PARTS_REQUESTS');
  return {
    hasTickets: !!tickets,
    ticketRows: tickets && tickets.getLastRow() > 1 ? tickets.getLastRow() - 1 : 0,
    hasItems: !!items,
    itemRows: items && items.getLastRow() > 1 ? items.getLastRow() - 1 : 0,
    hasRequests: !!requests,
    requestRows: requests && requests.getLastRow() > 1 ? requests.getLastRow() - 1 : 0,
    wroteToExistingSheets: false
  };
}

function PMR_showExistingPartsPeek() {
  var peek = PMR_peekExistingPartsData();
  SpreadsheetApp.getUi().alert(
    'Read-only peek (no existing tabs were changed)\n\n' +
    'PARTS_TICKETS rows: ' + peek.ticketRows + '\n' +
    'PARTS_ITEMS rows: ' + peek.itemRows + '\n' +
    'SVC_PARTS_REQUESTS rows: ' + peek.requestRows + '\n\n' +
    'Those tabs stay operational. Daily GM numbers are typed from CDK onto PMR_Daily.'
  );
}
