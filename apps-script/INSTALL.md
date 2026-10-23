# Install Sales Manager Report in the existing workbook

Target workbook:

`https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit`

Paste these files from the **repo root** (same place as `Code.gs` and `DealManager.gs`) into the bound Apps Script. `Code.gs` already calls `SLM_onOpen()`, so do not add a second `onOpen()`.

## Safety contract

- Do **not** replace `Code.gs` or any existing desking / Deal Log file.
- Do **not** create functions named `onOpen`, `onEdit`, `onInstall`, `onChange`, `onSelectionChange`, `doGet`, or `doPost`.
- Copy only files whose names start with `SLM_`.
- The installer creates only `SLM_*` tabs and never deletes, hides, or renames another sheet — including `SMR_*` service-manager tabs.

## Files to copy

Create these Apps Script files and paste the matching source from the repo root:

- `SLM_Config.gs`
- `SLM_Sheets.gs`
- `SLM_Api.gs`
- `SLM_Menu.gs`
- `SLM_Dashboard.gs`
- `SLM_Compatibility.gs`
- `SLM_Import.gs`
- `SLM_Email.gs`
- `SLM_App.html`

## Steps

1. Open the live workbook → **Extensions → Apps Script**.
2. Paste the nine `SLM_*` files above. Save.
3. In the Apps Script editor, select `SLM_install` and click **Run**. Authorize when prompted. Run this once only.
4. Reload the spreadsheet. Use **GEAUX TOOLS → Sales Manager Report → Open end-of-day recap**.

## Daily use

- The recap window opens maximized. Month-to-date new, used, gross, appts, shown appts, showroom visits, show %, and close % sit above the notes box and include today’s form numbers.
- Pick the date (defaults to today). Retail new/used units and front/back/total gross fill from `DEALINPUT` automatically. Wholesale, fleet, and dealer trades are skipped.
- Type **appts for the day**, **shown appts**, **total showroom visits**, and **appts for the next business day**. Those are not in the deal log.
- Override any pulled unit/gross number if a deal is still being logged. Use **Refresh from deal log** if deals were added after the date was already selected.
- **Email this report** saves the recap then sends a branded Geaux Chevrolet email. Recipient is `SLM_Config` → **Report email**. Leave that cell blank until you have the address. The button will ask once, then keep it. Menu: **Set report email**.

Next business day skips Sunday. Saturday recaps set Monday as the next selling day.

## What it will not do

- It will not write `DEALINPUT`, `SUMMARY`, `HOME`, `LOGDEAL`, or any other existing tab.
- It will not install over the Service Manager Report. Both menus can live in the same workbook.
