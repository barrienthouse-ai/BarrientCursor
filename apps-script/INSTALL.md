# Install Parts Manager Report in the existing workbook

Target workbook:

`https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit`

The workbook already has sales, service, fleet, and operational `PARTS_*` tabs. Apps Script source is still not in a Sheet export, so install continues to avoid reserved trigger names. Full inventory: `docs/GEAUXCHEVROLETSALESLOG.md`.

## Safety contract

- Do **not** replace any existing Apps Script file.
- Do **not** create functions named `onOpen`, `onEdit`, `onInstall`, `onChange`, `onSelectionChange`, `doGet`, or `doPost`.
- Copy only files whose names start with `PMR_` from this `apps-script/` folder.
- Never paste `apps-script-web/PMR_Web.gs` into this workbook. That file defines `doGet` for the standalone link. Use `apps-script-web/INSTALL.md` instead.
- The installer creates only `PMR_*` tabs and never deletes, hides, or renames another sheet.

## Steps

1. Open the live workbook → **Extensions → Apps Script**.
2. Create these files and paste the matching source from this folder:
   - `PMR_Config.gs`
   - `PMR_Sheets.gs`
   - `PMR_Api.gs`
   - `PMR_Menu.gs`
   - `PMR_Dashboard.gs`
   - `PMR_Compatibility.gs`
   - `PMR_Import.gs`
   - `PMR_Email.gs`
   - `PMR_App.html`
3. Leave every existing `.gs` / `.html` file exactly as it is. Never paste PMR source into `Code.gs` or the Sales / Service / Fleet files.
4. If you already have `onOpen`, add this at the **end** of that function — do not replace the function:

   ```javascript
   try { PMR_onOpen(); } catch (ignore) {}
   ```

5. In the Apps Script editor, select `PMR_install` and click **Run**. Authorize when prompted.
6. Reload the spreadsheet. Use the **Parts Manager Report** menu.
7. Optional: run **Compatibility audit** to list every non-PMR sheet the tool will leave alone. Set **Report email** so the GM recap can send.

`PMR_App.html` must not contain `<? ?>` scriptlets. The menu opens it as plain HTML (`createHtmlOutputFromFile`). The briefing then loads today’s snapshot with `PMR_loadBriefing`.

## Daily use

- **Open briefing** — Briefing tab with capital, N6M, RIM, wait, lost sales, SOP, cores, and GM flags. Daily entry and boards are on their own tabs.
- **Recall day** — reloads a previously saved date into the form.
- **Save daily report** — upserts that date in `PMR_Daily`.
- Lost sales, SOP REC, backorders, and cores stay on the boards until stocked / installed / returned / closed.
- **Email GM recap** — saves, then sends the branded Geaux recap if `PMR_Config` has Report email.

CDK the parts manager should pull before saving: `MGR→INV`, `RSM/RST`, `SOP→RO`, `LSL`, `IRE`, `ORD`, `CRA`.

## Send the parts manager a link instead of the workbook

Google cannot share only the PMR tabs. To give the parts manager this tool without the sales log, deploy the **standalone web app** in `apps-script-web/INSTALL.md`. Save and recall still write `PMR_*` tabs in this workbook.
