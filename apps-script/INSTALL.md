# Install Fleet Manager Report in the existing workbook

Target workbook:

`https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit`

GEAUXCHEVROLETSALESLOG already logs deals on `DEALINPUT` and keeps accounts on `FLEET CUSTOMERS`. This installer adds a daily fleet briefing without replacing those tools or the Service / Sales manager reports. Full inventory: `docs/GEAUXCHEVROLETSALESLOG.md`.

## Safety contract

- Do **not** replace any existing Apps Script file.
- Do **not** create functions named `onOpen`, `onEdit`, `onInstall`, `onChange`, `onSelectionChange`, `doGet`, or `doPost`.
- Copy only files whose names start with `FLM_` from this `apps-script/` folder.
- Never paste `apps-script-web/FLM_Web.gs` into this workbook. That file defines `doGet` for the standalone link. Use `apps-script-web/INSTALL.md` instead.
- The installer creates only `FLM_*` tabs and never deletes, hides, or renames another sheet — including `SMR_*` and `SLM_*` if those are already installed.

## Steps

1. Open the live workbook → **Extensions → Apps Script**.
2. Create these files and paste the matching source from this folder:
   - `FLM_Config.gs`
   - `FLM_Sheets.gs`
   - `FLM_Api.gs`
   - `FLM_Menu.gs`
   - `FLM_Dashboard.gs`
   - `FLM_Compatibility.gs`
   - `FLM_Import.gs`
   - `FLM_App.html`
3. Leave every existing `.gs` / `.html` file exactly as it is.
4. If you already have `onOpen`, add this single line inside it:

   ```javascript
   FLM_onOpen();
   ```

5. In the Apps Script editor, select `FLM_install` and click **Run**. Authorize when prompted. Run this once only.
6. Reload the spreadsheet. Use the **Fleet Manager Report** menu → **Open briefing**.

## Daily use

- Pick the report date. Sold units and front / finance / total gross fill from `DEALINPUT` when TYPE or DEPT is Fleet or Commercial.
- Type **working deals**, **daily deliveries**, **courtesy deliveries**, and **total expected deliveries**. Those are not on the deal log.
- Set the **monthly unit goal** and **gross goal** once. Pace includes today’s form numbers.
- Log working deals on the pipeline board. Mark them Sold, then Deliver. Expected delivery dates feed total expected deliveries.
- **Save daily report** upserts that date on `FLM_Daily` and refreshes `FLM_Dashboard`.

## Send the fleet manager a link instead of the workbook

Google cannot share only the FLM tabs. To give the fleet desk this tool without the sales log, deploy the **standalone web app** in `apps-script-web/INSTALL.md`. Save and recall still write `FLM_*` tabs in this workbook.

## What it will not do

- It will not write `DEALINPUT`, `FLEET CUSTOMERS`, `SUMMARY`, `HOME`, `LOGDEAL`, or any other existing tab.
- It will not install over the Service Manager Report or the Sales Manager Report. All three menus can live in the same workbook.
