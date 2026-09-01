# Service Manager Report

Reporting tool for the service manager to send daily numbers up to leadership, without touching the other tools already living in the shop Google Sheet.

## What it tracks

- Daily technician clock and sold hours, with names filled from the service roster
- Daily production board: sold hours, ELR (labor gross ÷ sold hours), hours per RO (sold hours ÷ ROs closed today), and unapplied time (clock − sold)
- Sold hours for the current week (Monday–Friday)
- Sold hours for the current week (Monday–Friday)
- Payroll / clock hours for last Tuesday through the current week’s Monday
- Service department gross only (labor and other service). Parts is out of scope
- Recall of any previously saved day
- Heat cases that need a briefing, including assigned advisor, technician, and customer name

## Two ways to use it

1. **This web app** — run locally to enter and review the same briefing.
2. **Google Apps Script** in `apps-script/` — paste into the existing workbook. It only creates `SMR_*` tabs and `SMR_*` functions, so current menus, triggers, and sheets stay intact.

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
- `apps-script/` — copy-safe Google Apps Script package
- `test/` — unit and API tests
