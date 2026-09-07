/**
 * Standalone web app entry. Paste this file ONLY into a new Apps Script
 * project. Never add it to GEAUXCHEVROLETSALESLOG — that workbook cannot
 * define doGet without colliding with the other shop tools.
 *
 * Save / recall still write SMR_* tabs in the live workbook below.
 */
var SMR_WEB_WORKBOOK_ID = '1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w';

function doGet() {
  return SMR_briefingHtml_().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function SMR_webHealth() {
  var ss = SMR_ss_();
  return {
    ok: true,
    workbookId: ss.getId(),
    workbookName: ss.getName(),
    executeAs: Session.getEffectiveUser().getEmail()
  };
}
