# Install Sales Manager Report in the existing workbook

Target workbook:

`https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit`

GEAUXCHEVROLETSALESLOG already logs deals on `DEALINPUT` and rolls MTD on `SUMMARY`. This installer adds a daily end-of-day recap for sales managers without replacing those tools. Full inventory: `docs/GEAUXCHEVROLETSALESLOG.md`.

## Safety contract

- Do **not** replace any existing Apps Script file.
- Do **not** create functions named `onOpen`, `onEdit`, `onInstall`, `onChange`, `onSelectionChange`, `doGet`, or `doPost`.
- Copy only files whose names start with `SLM_`.
- The installer creates only `SLM_*` tabs and never deletes, hides, or renames another sheet — including `SMR_*` service-manager tabs if those are already installed.

## Steps

1. Open the live workbook → **Extensions → Apps Script**.
2. Create these files and paste the matching source from this folder:
   - `SLM_Config.gs`
   - `SLM_Sheets.gs`
   - `SLM_Api.gs`
   - `SLM_Menu.gs`
   - `SLM_Dashboard.gs`
   - `SLM_Compatibility.gs`
   - `SLM_Import.gs`
   - `SLM_App.html`
3. Leave every existing `.gs` / `.html` file exactly as it is.
4. If you already have `onOpen`, add this single line inside it:

   ```javascript
   SLM_onOpen();
   ```

5. In the Apps Script editor, select `SLM_install` and click **Run**. Authorize when prompted. Run this once only.
6. Reload the spreadsheet. Use the **Sales Manager Report** menu → **Open end-of-day recap**.

## Daily use

- Pick the date (defaults to today). Retail new/used units and front/back/total gross fill from `DEALINPUT` automatically. Wholesale and dealer trades are skipped.
- If a day with deals (for example 8/31/2026) says there are none, replace `SLM_Config.gs`, `SLM_Import.gs`, `SLM_Api.gs`, and `SLM_App.html`. The old peek read the empty formula tail of DEALINPUT instead of the last real deal row.
- Type **appts for the day**, **shown appts**, **total showroom visits**, and **appts for the next business day**. Those are not in the deal log.
- Override any pulled unit/gross number if a deal is still being logged. Use **Refresh from deal log** if deals were added after the date was already selected.
- **Save daily report** upserts that date on `SLM_Daily` and refreshes `SLM_Dashboard`.

Next business day skips Sunday. Saturday recaps set Monday as the next selling day.

## What it will not do

- It will not write `DEALINPUT`, `SUMMARY`, `HOME`, `LOGDEAL`, or any other existing tab.
- It will not install over the Service Manager Report. Both menus can live in the same workbook.
