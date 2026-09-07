# Send the Parts Manager Report as a link

The parts manager opens a URL. They do not open GEAUXCHEVROLETSALESLOG. Save, recall, boards, and the GM email still write only to the `PMR_*` tabs in that workbook.

Do **not** paste `PMR_Web.gs` into the live 69-tab sheet. `doGet` lives only in this standalone project.

## 1. Create a new Apps Script project

1. Go to [script.google.com](https://script.google.com) while signed in as the workbook owner.
2. **New project**. Name it `Geaux Parts Manager Report`.
3. This project is standalone. It is not Extensions → Apps Script inside the sales log.

## 2. Paste these files

From `apps-script/` (same files as the sheet tool):

- `PMR_Config.gs`
- `PMR_Sheets.gs`
- `PMR_Api.gs`
- `PMR_Menu.gs`
- `PMR_Dashboard.gs`
- `PMR_Compatibility.gs`
- `PMR_Import.gs`
- `PMR_Email.gs`
- `PMR_App.html`

From `apps-script-web/` (this folder only):

- `PMR_Web.gs`

Optional: Project Settings → Show `appsscript.json`, replace it with `apps-script-web/appsscript.json`. If you skip this, Google will ask for spreadsheet and Gmail permission on first run.

Confirm `PMR_Web.gs` has this workbook ID:

`1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w`

## 3. Authorize once (you, not the parts manager)

1. In the editor, choose `PMR_install` → **Run**.
2. Authorize access to Google Sheets (and Gmail if you want the GM recap to send).
3. Then run `PMR_webHealth`. It should return the live workbook name. If it errors on `openById`, the ID is wrong or this Google account cannot open the sales log.

## 4. Deploy the web app

1. **Deploy → New deployment**.
2. Type: **Web app**.
3. Description: `Parts Manager Report`.
4. **Execute as:** Me (your Google account).
5. **Who has access:** the parts manager’s Google account, or “Anyone with a Google account” if they will sign in with Gmail.
6. **Deploy**. Copy the Web app URL.

Later UI tweaks: **Deploy → Manage deployments → Edit → New version**. The URL stays the same.

## 5. Send the parts manager

Send only the Web app URL. They sign in with Google and use Briefing / Daily entry / Boards as usual.

They should **not** get the sales log workbook link.

## What this does and does not do

- Writes `PMR_Daily`, `PMR_LostSales`, `PMR_Sop`, `PMR_Backorders`, `PMR_Cores`, `PMR_Dashboard`, `PMR_Config` in the live workbook.
- Does not write `PARTS_ITEMS`, `PARTS_TICKETS`, `SVC_PARTS_REQUESTS`, `HOME`, `SUMMARY`, `SLM_*`, `SMR_*`, or `FLM_*`.
- Snapshot cache is per Apps Script project. The in-sheet menu and this link share the same tabs; after a save on one, **Recall day** on the other reloads from those tabs.

## If the page is blank or permission denied

- You must run `PMR_install` / `PMR_webHealth` once so the web app is authorized as you.
- The parts manager must use a Google account allowed on the deployment.
- Re-save `PMR_App.html` and deploy a **New version** if the briefing UI looks old.
