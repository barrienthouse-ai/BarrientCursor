# Service Manager Report

Reporting tool for the service manager to send daily numbers up to leadership, without touching the other tools already living in the shop Google Sheet.

## What it tracks

- Daily technician clock and sold hours, with names filled from the service roster
- Daily production board: sold hours, ELR, hours per RO, unapplied time
- Store repair orders: open now, opened today, closed today, and month-to-date opened/closed
- Sold hours for the current week (Monday–Friday)
- Payroll / clock hours for last Tuesday through the current week’s Monday
- Service department gross only (labor and other service). Parts is out of scope
- Recall of any previously saved day
- Heat cases that need a briefing, including assigned advisor, technician, and customer name

## Three ways to use it

1. **Standalone web app** — deploy `apps-script-web/` as a link. The service manager never opens the sales log. Save and recall still write `SMR_*` tabs in GEAUXCHEVROLETSALESLOG. See `apps-script-web/INSTALL.md`.
2. **In the live workbook** — paste `apps-script/` into Extensions → Apps Script. It only creates `SMR_*` tabs and `SMR_*` functions. Never paste `SMR_Web.gs` there.
3. **This local Node app** — run on your computer to preview the same briefing. It saves to a local JSON file, not the Google Sheet.

The live workbook is GEAUXCHEVROLETSALESLOG:

https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit

Inventory of its 69 tabs and the existing service tools is in `docs/GEAUXCHEVROLETSALESLOG.md`. Install rules are in `apps-script/INSTALL.md`.

## Local setup

```bash
npm install
npm test
npm start
```

Open http://localhost:3000

## Project layout

- `src/reporting.js` — date, hour, gross, heat-case, and compatibility rules
- `src/store.js` — JSON store used by the local app
- `public/` — briefing UI
- `apps-script/` — copy-safe Google Apps Script package for the live workbook (no `doGet`)
- `apps-script-web/` — standalone `doGet` web app that opens that workbook by ID
- `test/` — unit and API tests
