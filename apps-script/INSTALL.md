# Install Service Manager Report in the existing workbook

Target workbook:

`https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit`

The workbook is now readable. It already has 69 tabs, including `SERVICE BOARD` and hidden `SVC_RO` tables. Apps Script source is still not in a Sheet export, so install continues to avoid reserved trigger names. Full inventory: `docs/GEAUXCHEVROLETSALESLOG.md`.

## Safety contract

- Do **not** replace any existing Apps Script file.
- Do **not** create functions named `onOpen`, `onEdit`, `onInstall`, `onChange`, `onSelectionChange`, `doGet`, or `doPost`.
- Copy only files whose names start with `SMR_` from this `apps-script/` folder.
- Never paste `apps-script-web/SMR_Web.gs` into this workbook. That file defines `doGet` for the standalone link. Use `apps-script-web/INSTALL.md` instead.
- The installer creates only `SMR_*` tabs and never deletes, hides, or renames another sheet.

## Steps

1. Open the live workbook → **Extensions → Apps Script**.
2. Create these files and paste the matching source from this folder:
   - `SMR_Config.gs`
   - `SMR_Sheets.gs`
   - `SMR_Api.gs`
   - `SMR_Menu.gs`
   - `SMR_Dashboard.gs`
   - `SMR_Compatibility.gs`
   - `SMR_App.html`
3. Leave every existing `.gs` / `.html` file exactly as it is.
4. If you already have `onOpen`, add this single line inside it:

   ```javascript
   SMR_onOpen();
   ```

5. In the Apps Script editor, select `SMR_install` and click **Run**. Authorize when prompted. Run this once only. Opening the briefing no longer creates sheets, so it will not time out on this large workbook.
6. Reload the spreadsheet. Use the **Service Manager Report** menu.
7. Optional: run **Compatibility audit** to list every non-SMR sheet the tool will leave alone.

## Speed update (replace these files)

This workbook is large (~18MB, 69 tabs). Each spreadsheet read from Apps Script is slow, so the briefing now avoids those reads after the first save.

Replace these files with the latest copies — no need to re-run `SMR_install` unless `SMR_HeatCases` is missing:

- `SMR_App.html`
- `SMR_Api.gs`
- `SMR_Sheets.gs`
- `SMR_Menu.gs`
- `SMR_Config.gs`
- `SMR_Dashboard.gs`

What changes:

- Technician rows still paint immediately from the SERVICE BOARD names.
- After you **Save daily report** once, the next **Open briefing** for that date fills hours and gross from a small `SMR_` snapshot (Cache / Script Properties). It does not scan the workbook.
- Changing dates or the first open of a new day only reads the small `SMR_TechHours` and `SMR_Gross` tabs — not `SERVICE BOARD`, `SVC_RO`, or the rest of the workbook.
- Heat cases load in a second, lighter call so they do not block the hours form.

`SMR_Menu.gs` must be replaced too. It now opens the dialog as a template so today’s saved snapshot can be injected before the form appears. If you leave the old menu file, the dialog will break on `seedJson`.

## Daily use

- **Open briefing** now matches the local briefing: Briefing tab with sold hours, ELR, hours/RO, unapplied, hours-by-tech table, and heat cases. Daily entry and heat logging are on their own tabs.
- Replace `SMR_App.html` and `SMR_Menu.gs` for this layout. Save in Apps Script, reload the spreadsheet, then **Service Manager Report → Open briefing**. Do not re-run `SMR_install`.
- **ROs closed today** is a shop-wide count used for Hours / RO. It is not entered per technician.
- **Recall day** — reloads a previously saved date into the form.
- **Save daily report** — upserts that date in `SMR_TechHours`, `SMR_Gross`, and `SMR_RepairOrders`.
- Heat cases stay on the briefing until **Resolve**. The resolved timestamp and notes are stored on `SMR_HeatCases`.
- Each heat case now has a customer name, assigned service advisor, and assigned technician. Those show on the heat list. Adding a case appends `Advisor` and `Technician` columns on `SMR_HeatCases` if they are missing; existing rows are not rewritten.

## Send the service manager a link instead of the workbook

Google cannot share only the SMR tabs. To give the service manager this tool without the sales log, deploy the **standalone web app** in `apps-script-web/INSTALL.md`. Save and recall still write `SMR_*` tabs in this workbook.

## If you want a script-level review

Share the workbook as **Anyone with the link can view**, or paste the existing script file/function names. A follow-up pass can then map those names against the `SMR_` namespace.
