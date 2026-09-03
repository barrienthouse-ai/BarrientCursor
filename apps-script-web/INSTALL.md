# Send the Service Manager Report as a link

The service manager opens a URL. They do not open GEAUXCHEVROLETSALESLOG. Save, recall, and heat cases still write only to the `SMR_*` tabs in that workbook.

Do **not** paste `SMR_Web.gs` into the live 69-tab sheet. `doGet` lives only in this standalone project.

## 1. Create a new Apps Script project

1. Go to [script.google.com](https://script.google.com) while signed in as the workbook owner.
2. **New project**. Name it `Geaux Service Manager Report`.
3. This project is standalone. It is not Extensions → Apps Script inside the sales log.

## 2. Paste these files

From `apps-script/` (same files as the sheet tool):

- `SMR_Config.gs`
- `SMR_Sheets.gs`
- `SMR_Api.gs`
- `SMR_Menu.gs`
- `SMR_Dashboard.gs`
- `SMR_Compatibility.gs`
- `SMR_Import.gs`
- `SMR_App.html`

From `apps-script-web/` (this folder only):

- `SMR_Web.gs`

Optional: Project Settings → Show `appsscript.json`, replace it with `apps-script-web/appsscript.json`. If you skip this, Google will ask for spreadsheet permission on first run.

Confirm `SMR_Web.gs` has this workbook ID:

`1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w`

## 3. Authorize once (you, not the service manager)

1. In the editor, choose `SMR_install` → **Run**.
2. Authorize access to Google Sheets.
3. Then run `SMR_webHealth`. It should return the live workbook name. If it errors on `openById`, the ID is wrong or this Google account cannot open the sales log.

## 4. Deploy the web app

1. **Deploy → New deployment**.
2. Type: **Web app**.
3. Description: `Service Manager Report`.
4. **Execute as:** Me (your Google account).
5. **Who has access:** the service manager’s Google account, or “Anyone with a Google account” if they will sign in with Gmail.
6. **Deploy**. Copy the Web app URL.

Later UI tweaks: **Deploy → Manage deployments → Edit → New version**. The URL stays the same.

## 5. Send the service manager

Send only the Web app URL. They sign in with Google and use Briefing / Daily entry / Heat cases as usual.

They should **not** get the sales log workbook link.

## What this does and does not do

- Writes `SMR_TechHours`, `SMR_Gross`, `SMR_RepairOrders`, `SMR_HeatCases`, `SMR_Dashboard`, `SMR_Roster`, `SMR_Config` in the live workbook.
- Does not write `SERVICE BOARD`, `SVC_RO`, `HOME`, `SUMMARY`, or any other existing tab.
- Snapshot cache is per Apps Script project. The in-sheet menu and this link share the same tabs; after a save on one, **Recall day** on the other reloads from those tabs.

## If the page is blank or permission denied

- You must run `SMR_install` / `SMR_webHealth` once so the web app is authorized as you.
- The service manager must use a Google account allowed on the deployment.
- Re-save `SMR_App.html` and deploy a **New version** if the briefing UI looks old.
