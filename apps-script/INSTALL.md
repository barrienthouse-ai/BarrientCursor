# Install Service Manager Report in the existing workbook

Target workbook:

`https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit`

This project could not read that file from the Cloud Agent environment (Google redirected to sign-in). Install is therefore designed so a live script inventory is not required.

## Safety contract

- Do **not** replace any existing Apps Script file.
- Do **not** create functions named `onOpen`, `onEdit`, `onInstall`, `onChange`, `onSelectionChange`, `doGet`, or `doPost`.
- Copy only files whose names start with `SMR_`.
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

5. In the Apps Script editor, select `SMR_install` and click **Run**. Authorize when prompted.
6. Reload the spreadsheet. Use the **Service Manager Report** menu.
7. Optional: run **Compatibility audit** to list every non-SMR sheet the tool will leave alone.

## Daily use

- **Open briefing** — tech hours, daily/MTD gross, open/closed/written ROs, heat cases.
- **Recall day** — reloads a previously saved date into the form.
- **Save daily report** — upserts that date in `SMR_TechHours`, `SMR_Gross`, and `SMR_RepairOrders`.
- Heat cases stay on the briefing until **Resolve**. The resolved timestamp and notes are stored on `SMR_HeatCases`.

## If you want a script-level review

Share the workbook as **Anyone with the link can view**, or paste the existing script file/function names. A follow-up pass can then map those names against the `SMR_` namespace.
